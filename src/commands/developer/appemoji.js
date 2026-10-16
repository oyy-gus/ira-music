const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require('discord.js');

const { getEmoji, APPLICATION_EMOJIS } = require('../../config/emojis');
const logger = require('../../logger/logger');

const cleanEmojiName = (str) => {
  if (!str) return '';

  let name = str.replace(/\.(png|jpg|jpeg|gif|webp|svg)$/i, '');
  name = name.replace(/[\s\-\.]+/g, '_');
  name = name.replace(/[^a-zA-Z0-9_]/g, '');

  if (name.length > 32) {
    name = name.substring(0, 32);
  }

  if (name.length < 2) {
    name = (name + '_emoji').substring(0, 32);
  }

  return name;
};

// -------------------------------------------------------------
// BUILD PAGINATION BUTTONS
// -------------------------------------------------------------
const buildEmojiListButtons = (
  currentPage,
  totalPages,
  disabledAll = false,
  client = null
) => {
  const e = (key, fallback = '') => {
    const value = getEmoji(key, fallback, client);

    // Never return an empty string for a button label/emoji.
    if (typeof value !== 'string' || !value.trim()) {
      return '';
    }

    return value.trim();
  };

  const createButton = ({
    customId,
    emojiKey,
    alternateEmojiKey = null,
    fallbackEmoji,
    style,
    disabled,
  }) => {
    const primaryEmoji = e(emojiKey);
    const alternateEmoji = alternateEmojiKey
      ? e(alternateEmojiKey)
      : '';

    const customEmoji = primaryEmoji || alternateEmoji;

    const button = new ButtonBuilder()
      .setCustomId(customId)
      .setStyle(style)
      .setDisabled(disabled);

    if (customEmoji) {
      // Use custom/application emoji.
      button.setEmoji(customEmoji);
    } else {
      // Always use a valid non-empty label as fallback.
      button.setLabel(fallbackEmoji);
    }

    return button;
  };

  const btnFirst = createButton({
    customId: 'appemoji_first',
    emojiKey: 'first',
    fallbackEmoji: '⏮️',
    style: ButtonStyle.Secondary,
    disabled: disabledAll || currentPage <= 1,
  });

  const btnPrev = createButton({
    customId: 'appemoji_prev',
    emojiKey: 'previous',
    alternateEmojiKey: 'prev',
    fallbackEmoji: '◀️',
    style: ButtonStyle.Primary,
    disabled: disabledAll || currentPage <= 1,
  });

  const btnStop = createButton({
    customId: 'appemoji_stop',
    emojiKey: 'stop',
    alternateEmojiKey: 'clear',
    fallbackEmoji: '⏹️',
    style: ButtonStyle.Danger,
    disabled: disabledAll,
  });

  const btnNext = createButton({
    customId: 'appemoji_next',
    emojiKey: 'next',
    fallbackEmoji: '▶️',
    style: ButtonStyle.Primary,
    disabled: disabledAll || currentPage >= totalPages,
  });

  const btnLast = createButton({
    customId: 'appemoji_last',
    emojiKey: 'last',
    fallbackEmoji: '⏭️',
    style: ButtonStyle.Secondary,
    disabled: disabledAll || currentPage >= totalPages,
  });

  return new ActionRowBuilder().addComponents(
    btnFirst,
    btnPrev,
    btnStop,
    btnNext,
    btnLast
  );
};

module.exports = {
  name: 'appemoji',
  description: 'Manage Bot Application Emojis (list, add, remove, edit, sync)',
  aliases: ['appemojis', 'applicationemoji', 'devemoji'],
  category: 'developer',
  ownerOnly: true,
  cooldown: 3,

  async execute({ message, args, rawArgsString, client }) {
    const e = (key, fallback = '') => {
      const value = getEmoji(key, fallback, client);

      if (typeof value !== 'string' || !value.trim()) {
        return '';
      }

      return value.trim();
    };

    const subCommand = (args[0] || 'list').toLowerCase();

    // -------------------------------------------------------------
    // SUBCOMMAND 1: LIST / LS
    // -------------------------------------------------------------
    if (subCommand === 'list' || subCommand === 'ls') {
      try {
        const fetchedEmojis = await client.application.emojis.fetch();
        const emojiList = Array.from(fetchedEmojis.values());

        if (emojiList.length === 0) {
          const embed = new EmbedBuilder()
            .setTitle(`${e('info')}Application Emojis`)
            .setDescription(
              'No custom Application Emojis are registered yet.\n' +
              'Use `appemoji add` to upload your first emoji!'
            )
            .setColor(0x5865f2);

          return message.reply({
            embeds: [embed],
          });
        }

        const lines = emojiList.map((emoji, idx) => {
          const tag = emoji.toString();

          return (
            `\`${idx + 1}.\` ${tag} **${emoji.name}** — ` +
            `\`${emoji.id}\` ` +
            `${emoji.animated ? '*(animated)*' : ''}`
          );
        });

        const chunkSize = 15;
        const totalPages = Math.ceil(lines.length / chunkSize);
        const pages = [];

        for (let i = 0; i < lines.length; i += chunkSize) {
          const chunk = lines.slice(i, i + chunkSize);
          const pageNum = Math.floor(i / chunkSize) + 1;

          const embed = new EmbedBuilder()
            .setTitle(
              `${e('tools')}Bot Application Emojis (${emojiList.length})`
            )
            .setDescription(chunk.join('\n'))
            .setFooter({
              text:
                `Page ${pageNum} of ${totalPages} • ` +
                `App ID: ${client.application?.id || 'N/A'}`,
            })
            .setColor(0x5865f2);

          pages.push(embed);
        }

        // Only one page = no buttons needed.
        if (totalPages === 1) {
          return message.reply({
            embeds: [pages[0]],
          });
        }

        let currentPage = 1;

        const initialRow = buildEmojiListButtons(
          currentPage,
          totalPages,
          false,
          client
        );

        const replyMsg = await message.reply({
          embeds: [pages[0]],
          components: [initialRow],
        });

        const collector = replyMsg.createMessageComponentCollector({
          filter: (interaction) =>
            interaction.customId.startsWith('appemoji_'),
          time: 120000,
        });

        collector.on('collect', async (interaction) => {
          if (interaction.user.id !== message.author.id) {
            return interaction
              .reply({
                content:
                  `${e('error')}` +
                  'Only the user who ran the command can use these navigation buttons.',
                flags: MessageFlags.Ephemeral,
              })
              .catch(() => {});
          }

          const action = interaction.customId;

          if (action === 'appemoji_first') {
            currentPage = 1;
          } else if (action === 'appemoji_prev') {
            currentPage = Math.max(1, currentPage - 1);
          } else if (action === 'appemoji_next') {
            currentPage = Math.min(
              totalPages,
              currentPage + 1
            );
          } else if (action === 'appemoji_last') {
            currentPage = totalPages;
          } else if (action === 'appemoji_stop') {
            collector.stop('user_stopped');

            return interaction
              .deferUpdate()
              .catch(() => {});
          }

          const updatedRow = buildEmojiListButtons(
            currentPage,
            totalPages,
            false,
            client
          );

          await interaction
            .update({
              embeds: [pages[currentPage - 1]],
              components: [updatedRow],
            })
            .catch(() => {});
        });

        collector.on('end', async () => {
          const disabledRow = buildEmojiListButtons(
            currentPage,
            totalPages,
            true,
            client
          );

          await replyMsg
            .edit({
              components: [disabledRow],
            })
            .catch(() => {});
        });

        return replyMsg;
      } catch (err) {
        logger.error(
          '[AppEmoji] Error listing emojis:',
          err
        );

        const embed = new EmbedBuilder()
          .setTitle(`${e('error')}Error Listing Emojis`)
          .setDescription(
            `Failed to fetch Application Emojis: \`${err.message}\``
          )
          .setColor(0xed4245);

        return message.reply({
          embeds: [embed],
        });
      }
    }

    // -------------------------------------------------------------
    // SUBCOMMAND 2: ADD / CREATE / UPLOAD / A
    // -------------------------------------------------------------
    if (
      subCommand === 'add' ||
      subCommand === 'create' ||
      subCommand === 'upload' ||
      subCommand === 'a'
    ) {
      let imageSource = null;
      let rawNameInput = '';

      const attachment = message.attachments?.first();

      if (attachment) {
        imageSource = attachment.url;

        rawNameInput =
          args[1] ||
          attachment.name ||
          'custom_emoji';
      } else if (args[1]) {
        const inputStr = args[1];

        // Discord Emoji:
        // <:name:id>
        // <a:name:id>
        const customEmojiMatch =
          /<a?:([a-zA-Z0-9_]+):([0-9]+)>/.exec(
            inputStr
          );

        if (customEmojiMatch) {
          const emojiName = customEmojiMatch[1];
          const emojiId = customEmojiMatch[2];
          const isAnimated = inputStr.startsWith('<a:');

          imageSource =
            `https://cdn.discordapp.com/emojis/` +
            `${emojiId}.${isAnimated ? 'gif' : 'png'}`;

          rawNameInput =
            args[2] || emojiName;
        } else if (
          inputStr.startsWith('http://') ||
          inputStr.startsWith('https://')
        ) {
          imageSource = inputStr;

          const urlFilename =
            inputStr
              .split('/')
              .pop()
              .split('?')[0] ||
            'custom_emoji';

          rawNameInput =
            args[2] || urlFilename;
        }
      }

      if (!imageSource) {
        const embed = new EmbedBuilder()
          .setTitle(
            `${e('error')}Missing Image Source`
          )
          .setDescription(
            'Please provide an image to add as an Application Emoji!\n\n' +
            '**Usage Options:**\n' +
            '1. Upload an image attachment with: `appemoji add [optional_name]`\n' +
            '2. Provide an Image URL: `appemoji add <image_url> [optional_name]`\n' +
            '3. Provide a Discord Emoji tag: `appemoji add <:name:id> [optional_name]`'
          )
          .setColor(0xed4245);

        return message.reply({
          embeds: [embed],
        });
      }

      const finalEmojiName =
        cleanEmojiName(rawNameInput);

      try {
        const newEmoji =
          await client.application.emojis.create({
            attachment: imageSource,
            name: finalEmojiName,
          });

        // Update in-memory APPLICATION_EMOJIS registry
        if (
          Object.prototype.hasOwnProperty.call(
            APPLICATION_EMOJIS,
            finalEmojiName.toLowerCase()
          )
        ) {
          APPLICATION_EMOJIS[
            finalEmojiName.toLowerCase()
          ] = newEmoji.id;
        }

        const embed = new EmbedBuilder()
          .setTitle(
            `${e('success')}Application Emoji Created`
          )
          .setDescription(
            `Successfully created Application Emoji ${newEmoji}!\n\n` +
            `• **Name:** \`${newEmoji.name}\`\n` +
            `• **ID:** \`${newEmoji.id}\`\n` +
            `• **Tag:** \`<:${newEmoji.name}:${newEmoji.id}>\`\n` +
            `• **Animated:** \`${newEmoji.animated ? 'Yes' : 'No'}\``
          )
          .setThumbnail(newEmoji.url)
          .setColor(0x57f287);

        return message.reply({
          embeds: [embed],
        });
      } catch (err) {
        logger.error(
          '[AppEmoji] Error creating emoji:',
          err
        );

        const embed = new EmbedBuilder()
          .setTitle(
            `${e('error')}Failed to Create Emoji`
          )
          .setDescription(
            `Could not create Application Emoji \`${finalEmojiName}\`:\n` +
            `\`${err.message}\``
          )
          .setColor(0xed4245);

        return message.reply({
          embeds: [embed],
        });
      }
    }

    // -------------------------------------------------------------
    // SUBCOMMAND 3: REMOVE / DELETE / DEL / RM
    // -------------------------------------------------------------
    if (
      subCommand === 'remove' ||
      subCommand === 'delete' ||
      subCommand === 'del' ||
      subCommand === 'rm'
    ) {
      const targetQuery = args[1];

      if (!targetQuery) {
        const embed = new EmbedBuilder()
          .setTitle(
            `${e('error')}Missing Target Emoji`
          )
          .setDescription(
            'Please specify the emoji name, ID, or tag to remove.\n\n' +
            '**Example:** `appemoji remove my_emoji`'
          )
          .setColor(0xed4245);

        return message.reply({
          embeds: [embed],
        });
      }

      try {
        const fetchedEmojis =
          await client.application.emojis.fetch();

        const tagMatch =
          /<a?:[a-zA-Z0-9_]+:([0-9]+)>/.exec(
            targetQuery
          );

        const searchId = tagMatch
          ? tagMatch[1]
          : targetQuery;

        const searchName =
          cleanEmojiName(targetQuery).toLowerCase();

        const targetEmoji =
          fetchedEmojis.find(
            (emojiItem) =>
              emojiItem.id === searchId ||
              emojiItem.name.toLowerCase() === searchName
          );

        if (!targetEmoji) {
          const embed = new EmbedBuilder()
            .setTitle(
              `${e('error')}Emoji Not Found`
            )
            .setDescription(
              `Could not find any Application Emoji matching \`${targetQuery}\`.`
            )
            .setColor(0xed4245);

          return message.reply({
            embeds: [embed],
          });
        }

        const deletedName =
          targetEmoji.name;

        const deletedId =
          targetEmoji.id;

        await targetEmoji.delete();

        const embed = new EmbedBuilder()
          .setTitle(
            `${e('success')}Application Emoji Removed`
          )
          .setDescription(
            `Successfully deleted Application Emoji **${deletedName}** ` +
            `(\`ID: ${deletedId}\`).`
          )
          .setColor(0x57f287);

        return message.reply({
          embeds: [embed],
        });
      } catch (err) {
        logger.error(
          '[AppEmoji] Error deleting emoji:',
          err
        );

        const embed = new EmbedBuilder()
          .setTitle(
            `${e('error')}Failed to Remove Emoji`
          )
          .setDescription(
            `Error deleting emoji \`${targetQuery}\`:\n` +
            `\`${err.message}\``
          )
          .setColor(0xed4245);

        return message.reply({
          embeds: [embed],
        });
      }
    }

    // -------------------------------------------------------------
    // SUBCOMMAND 4: EDIT / RENAME / UPDATE
    // -------------------------------------------------------------
    if (
      subCommand === 'edit' ||
      subCommand === 'rename' ||
      subCommand === 'update'
    ) {
      const targetQuery = args[1];
      const newNameInput = args[2];

      if (!targetQuery || !newNameInput) {
        const embed = new EmbedBuilder()
          .setTitle(
            `${e('error')}Invalid Usage`
          )
          .setDescription(
            'Please specify the current emoji and its new name.\n\n' +
            '**Example:** `appemoji edit old_name new_name`'
          )
          .setColor(0xed4245);

        return message.reply({
          embeds: [embed],
        });
      }

      try {
        const fetchedEmojis =
          await client.application.emojis.fetch();

        const tagMatch =
          /<a?:[a-zA-Z0-9_]+:([0-9]+)>/.exec(
            targetQuery
          );

        const searchId = tagMatch
          ? tagMatch[1]
          : targetQuery;

        const searchName =
          cleanEmojiName(targetQuery).toLowerCase();

        const targetEmoji =
          fetchedEmojis.find(
            (emojiItem) =>
              emojiItem.id === searchId ||
              emojiItem.name.toLowerCase() === searchName
          );

        if (!targetEmoji) {
          const embed = new EmbedBuilder()
            .setTitle(
              `${e('error')}Emoji Not Found`
            )
            .setDescription(
              `Could not find any Application Emoji matching \`${targetQuery}\`.`
            )
            .setColor(0xed4245);

          return message.reply({
            embeds: [embed],
          });
        }

        const oldName =
          targetEmoji.name;

        const newCleanName =
          cleanEmojiName(newNameInput);

        const updatedEmoji =
          await targetEmoji.edit({
            name: newCleanName,
          });

        const embed = new EmbedBuilder()
          .setTitle(
            `${e('success')}Application Emoji Renamed`
          )
          .setDescription(
            `Successfully renamed Application Emoji ${updatedEmoji}!\n\n` +
            `• **Old Name:** \`${oldName}\`\n` +
            `• **New Name:** \`${updatedEmoji.name}\`\n` +
            `• **ID:** \`${updatedEmoji.id}\``
          )
          .setColor(0x57f287);

        return message.reply({
          embeds: [embed],
        });
      } catch (err) {
        logger.error(
          '[AppEmoji] Error editing emoji:',
          err
        );

        const embed = new EmbedBuilder()
          .setTitle(
            `${e('error')}Failed to Edit Emoji`
          )
          .setDescription(
            `Error editing emoji \`${targetQuery}\`:\n` +
            `\`${err.message}\``
          )
          .setColor(0xed4245);

        return message.reply({
          embeds: [embed],
        });
      }
    }

    // -------------------------------------------------------------
    // SUBCOMMAND 5: SYNC
    // -------------------------------------------------------------
    if (subCommand === 'sync') {
      try {
        const fetchedEmojis =
          await client.application.emojis.fetch();

        let syncedCount = 0;

        fetchedEmojis.forEach((emojiItem) => {
          const normKey =
            emojiItem.name.toLowerCase();

          if (
            Object.prototype.hasOwnProperty.call(
              APPLICATION_EMOJIS,
              normKey
            )
          ) {
            APPLICATION_EMOJIS[normKey] =
              emojiItem.id;

            syncedCount++;
          }
        });

        const embed = new EmbedBuilder()
          .setTitle(
            `${e('success')}Application Emojis Synced`
          )
          .setDescription(
            `Successfully fetched **${fetchedEmojis.size}** ` +
            `Application Emojis from Discord API.\n` +
            `Synced **${syncedCount}** keys with in-memory registry.`
          )
          .setColor(0x57f287);

        return message.reply({
          embeds: [embed],
        });
      } catch (err) {
        logger.error(
          '[AppEmoji] Error syncing emojis:',
          err
        );

        const embed = new EmbedBuilder()
          .setTitle(
            `${e('error')}Sync Failed`
          )
          .setDescription(
            `Failed to sync Application Emojis:\n` +
            `\`${err.message}\``
          )
          .setColor(0xed4245);

        return message.reply({
          embeds: [embed],
        });
      }
    }

    // -------------------------------------------------------------
    // DEFAULT HELP
    // -------------------------------------------------------------
    const embed = new EmbedBuilder()
      .setTitle(
        `${e('tools')}Application Emoji Manager`
      )
      .setDescription(
        'Manage Application Emojis directly from Discord!\n\n' +
        '**Subcommands:**\n' +
        '• `appemoji list` — View all registered Bot Application Emojis\n' +
        '• `appemoji add [name]` (with image attached) — Upload image & auto-detect/set name\n' +
        '• `appemoji add <url|tag> [name]` — Add emoji from Image URL or Discord Tag\n' +
        '• `appemoji remove <name|id|tag>` — Delete an Application Emoji\n' +
        '• `appemoji edit <target> <new_name>` — Rename an Application Emoji\n' +
        '• `appemoji sync` — Sync Discord API emojis with bot registry'
      )
      .setColor(0x5865f2);

    return message.reply({
      embeds: [embed],
    });
  },
};
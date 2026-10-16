const { MessageFlags } = require('discord.js');
const logger = require('../logger/logger');
const { getEmoji } = require('../config/emojis');
const { handleQueueButton } = require('../commands/music/queue');

const handleButtonInteraction = async (interaction, client) => {
  const { customId, guildId, member } = interaction;

  if (customId.startsWith('q_')) {
    return handleQueueButton(interaction, client);
  }

  if (!customId.startsWith('music_')) return;

  const emoji = (key) => {
    const e = getEmoji(key, client);
    return e ? `${e} ` : '';
  };

  const player = client.lavalink?.players.get(guildId);
  if (!player || !player.connected) {
    return interaction.reply({ content: `${emoji('error')}No active music session.`, flags: MessageFlags.Ephemeral });
  }

  if (!member?.voice?.channel || member.voice.channel.id !== player.voiceChannelId) {
    return interaction.reply({ content: `${emoji('error')}You must be in the same voice channel as the bot.`, flags: MessageFlags.Ephemeral });
  }

  try {
    switch (customId) {
      case 'music_pause':
        if (player.paused) {
          await player.resume();
          await interaction.reply({ content: `${emoji('play')}Playback resumed.`, flags: MessageFlags.Ephemeral });
        } else {
          await player.pause();
          await interaction.reply({ content: `${emoji('pause')}Playback paused.`, flags: MessageFlags.Ephemeral });
        }
        break;

      case 'music_skip':
        if (!player.queue.current) {
          return interaction.reply({ content: `${emoji('error')}Nothing to skip.`, flags: MessageFlags.Ephemeral });
        }
        await player.skip();
        await interaction.reply({ content: `${emoji('skip')}Skipped track.`, flags: MessageFlags.Ephemeral });
        break;

      case 'music_shuffle':
        player.queue.shuffle();
        await interaction.reply({ content: `${emoji('shuffle')}Queue shuffled.`, flags: MessageFlags.Ephemeral });
        break;

      case 'music_stop':
        await player.destroy();
        await interaction.reply({ content: `${emoji('stop')}Playback stopped.`, flags: MessageFlags.Ephemeral });
        break;

      default:
        break;
    }
  } catch (error) {
    logger.error(`[Interaction] Error processing ${customId}:`, { error: error.message });
    await interaction.reply({ content: `${emoji('error')}Error executing component interaction.`, flags: MessageFlags.Ephemeral }).catch(() => {});
  }
};

module.exports = {
  handleButtonInteraction,
};

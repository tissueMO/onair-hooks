module.exports = {
  shuffles: [
    {
      guildId: '111111111111111111',
    },
  ],
  records: [
    {
      guildId: '111111111111111111',
      defaultChannelId: '111111111111111111',
      defaultSummaryType: 'official',
      autoSummarizeAbortDuration: 30 * 60,
      autoSummarizeDelayTime: 30,
      autoSummarizeMinDuration: 600,
      captureTimeout: 1,
      captureMinDuration: 3,
    },
  ],
  hooks: [
    {
      guildId: '111111111111111111',
      userId: '111111111111111111',
      state: 'on',
      hook: {
        url: 'https://example.com/',
        method: 'get',
      },
    },
    {
      guildId: '111111111111111111',
      userId: '111111111111111111',
      state: 'off',
      hook: {
        url: 'https://example.com/',
        method: 'get',
      },
    },
  ],
};

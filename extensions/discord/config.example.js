module.exports = {
  shuffles: [
    {
      guildId: '111111111111111111',
    },
  ],
  records: [
    {
      guildId: '111111111111111111',
      expires: 43200,
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
  follows: [
    {
      guildId: '111111111111111111',
      followerUserId: '111111111111111111',
      followeeUserId: '111111111111111111',
    },
  ],
};

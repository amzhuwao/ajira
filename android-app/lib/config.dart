/// Production API base. Override with --dart-define=API_BASE=http://10.0.2.2:3000 for local.
const String kApiBase = String.fromEnvironment(
  'API_BASE',
  defaultValue: 'https://ajira.online',
);

const String kMobileApiPrefix = '/api/mobile/v1';

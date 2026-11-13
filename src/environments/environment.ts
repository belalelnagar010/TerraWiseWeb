/**
 * Runtime environment config.
 *
 * `apiBaseUrl` points at the live TerraWise backend. The analyze endpoint is
 * therefore `${apiBaseUrl}/analyze`. For a production build, add a
 * `fileReplacements` entry in angular.json swapping this for an environment
 * file with the deployed URL.
 */
export const environment = {
  production: false,
  apiBaseUrl: 'http://localhost:5080/api',
};

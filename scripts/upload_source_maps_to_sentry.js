import SentryCli from "@sentry/cli";
import version from '../src/apps/VirtualApp/Version.js';

async function createReleaseAndUpload() {
	const cli = new SentryCli();

  try {
    console.log('Creating sentry release ' + version);
    await cli.releases.new(version);

    console.log('Uploading source maps');
    await cli.releases.uploadSourceMaps(version, {
      include: ['build/static/js'],
      urlPrefix: '~/static/js',
      rewrite: false,
    });

    console.log('Finalizing release');
    await cli.releases.finalize(version);
  } catch (e) {
    console.error('Source maps uploading failed:', e);
		process.exit(1);
  }
}

createReleaseAndUpload();

import SentryCli from "@sentry/cli";
import version from '../src/Version';

async function createReleaseAndUpload() {
  const release = process.env.NODE_ENV === 'development' ? 'dev' : version;

  const cli = new SentryCli();

  try {
    console.log('Creating sentry release ' + release);
    await cli.releases.new(release);

    console.log('Uploading source maps');
    await cli.releases.uploadSourceMaps(release, {
      include: ['build/static/js'],
      urlPrefix: '~/static/js',
      rewrite: false,
    });

    console.log('Finalizing release');
    await cli.releases.finalize(release);
  } catch (e) {
    console.error('Source maps uploading failed:', e);
  }
}

createReleaseAndUpload();

const CronJob = require('cron').CronJob
const urlJoin = require('url-join')
const AwsHelper = require('./helpers/awsHelper')
const RancherHelper = require('./helpers/rancherHelper')
const log = require('./lib/log')


const RANCHER_URL = process.env.RANCHER_URL || 'http://169.254.169.250'
const RANCHER_PROJECT = process.env.RANCHER_PROJECT || '1a7'
const RANCHER_API_VERSION = 'v2-beta'

const projectPath = urlJoin(RANCHER_API_VERSION, 'projects')
const rancherPath = urlJoin(projectPath, RANCHER_PROJECT)

log.debug(`Rancher path: ${rancherPath}`)

const rancherConfig =  {
  baseUrl: RANCHER_URL,
  path:rancherPath,
}

const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID
const AWS_ACCESS_SECRET = process.env.AWS_ACCESS_SECRET
const RANCHER_ACCESS_KEY_ID = process.env.RANCHER_ACCESS_KEY_ID
const RANCHER_ACCESS_SECRET = process.env.RANCHER_ACCESS_SECRET
const REGION = process.env.AWS_REGION || 'eu-west-1'

const awsHelper = new AwsHelper(AWS_ACCESS_KEY_ID, AWS_ACCESS_SECRET, REGION)
const rancherHelper = new RancherHelper(rancherConfig, RANCHER_ACCESS_KEY_ID, RANCHER_ACCESS_SECRET)

const job = new CronJob({
  cronTime: '0 * * * * *',
  onTick: function () {
    log.info('Starting job')
    awsHelper.getDetachingInstances()
      .then(dnsNames => rancherHelper.detachInstances(dnsNames))
      .catch(err => {
        log.error('Error removing instances', err)
      })
    rancherHelper.getDisconnectedHosts()
      .then(hosts => awsHelper.determinedTerminatedHosts(hosts))
      .then(toRemove => rancherHelper.detachInstances(toRemove))
  },
  start: false
})

job.start()
log.info('Disconnnected instance removal job scheduled')

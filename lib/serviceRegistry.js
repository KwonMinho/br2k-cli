/**
 * About container command file
 */


const CONTEXTS_FILE = '/util/k8s/contexts.json';


const fs = require('fs');
const YAML = require('yaml');
const ServiceRegistryClient = require('./serviceRegistry-client');
const ora = require('ora');
const { printTable } = require('console-table-printer');
const check_config = require('./check_config');
const { exit } = require('process');


/*MAIN*/
module.exports = async function(type, args){

    const cfg = check_config();

    switch(type){
      case 'syncReplicas':
        await syncReplicas(args, cfg);
        break;
      case 'register':
        register(args, cfg);
        break;
      case 'view':
        view(args, cfg);
        break;
      case 'spray':
        spray(args, cfg);
        break;
      case 'updateReplicas':
        updateReplicas(args, cfg);
        break;
      case 'pause':
        pause(args, cfg);
        break;
      default:
        console.log('This command is not supported');
        break;
    }
}

async function syncReplicas(args, cfg){
  const project = cfg.project_path;
  const contextsFile = project+CONTEXTS_FILE;
  let ctFile = JSON.parse(fs.readFileSync(contextsFile));
  let contexts = ctFile.contexts;
  const curID = ctFile['current-context'];
  const context = contexts[curID];
  const curServiceName = context.Deployment['service-name'];
  const scvReg = context.Auth['service-registry'];

  const blockchainCfg = {'account': scvReg.account, 'endpoint': scvReg.endpoint}
  const serviceRegistry =  await _getServiceRegistryClient(blockchainCfg,"", project);
  const curReplicas = await serviceRegistry.getCurRerplicas(curServiceName);

  if(curReplicas != -1){
    ctFile.contexts[curID]['Deployment'].replicas = curReplicas;
    const newContent = JSON.stringify(ctFile, null, 2);
    fs.writeFileSync(contextsFile, newContent);
  }
}


async function pause(args, cfg){
  const project = cfg.project_path;
  const contextsFile = project+CONTEXTS_FILE;
  const ctFile = JSON.parse(fs.readFileSync(contextsFile));
  const contexts = ctFile.contexts;
  const curID = ctFile['current-context'];
  const context = contexts[curID];
  const serviceID = context.Deployment['service-name'];
  const scvReg = context.Auth['service-registry'];

  if(context.ServiceRegistry == null){
    console.log('There are no access account in the service registry');
    process.exit(1);
  }
  if(serviceID == null){
    console.log('There are no deployed services');
    return;
  }
  const blockchainCfg = {'account': scvReg.account, 'endpoint': scvReg.endpoint}
  const serviceRegistry =  await _getServiceRegistryClient(blockchainCfg,"", project);
  await serviceRegistry.pauseService(serviceID);
}



async function updateReplicas(args, cfg){
  const project = cfg.project_path;
  const contextsFile = project+CONTEXTS_FILE;
  const ctFile = JSON.parse(fs.readFileSync(contextsFile));
  const contexts = ctFile.contexts;
  const curID = ctFile['current-context'];
  const context = contexts[curID];
  const serviceID = context.Deployment['service-name'];
  const scvReg = context.Auth['service-registry'];
  const curReplicas = context.Deployment.replicas;

  if(context.ServiceRegistry == null){
    console.log('There are no access account in the service registry');
    process.exit(1);
  }
  if(serviceID == null){
    console.log('There are no deployed services');
    return;
  }

  const blockchainCfg = {'account': scvReg.account, 'endpoint': scvReg.endpoint}
  const serviceRegistry =  await _getServiceRegistryClient(blockchainCfg,"", project);
  await serviceRegistry.updateReplicas(serviceID, curReplicas);
}



async function spray(args, cfg){
  const project = cfg.project_path;
  const contextsFile = project+CONTEXTS_FILE;
  const ctFile = JSON.parse(fs.readFileSync(contextsFile));
  const contexts = ctFile.contexts;
  const curID = ctFile['current-context'];
  const context = contexts[curID];
  const scvReg = context.Auth['service-registry'];

  let serviceID = context.ServiceRegistry['id'];
  let replicas = args.replicas;
  let secret = args.secret;

  if(context.ServiceRegistry == null){
    console.log('There are no access account in the service registry');
    process.exit(1);
  }
  if(serviceID == null){
    console.log('There are no services stored in the service registry');
    return;
  }
  if(secret == null) secret = '';

  const blockchainCfg = {'account': scvReg.account, 'endpoint': scvReg.endpoint}
  const serviceRegistry =  await _getServiceRegistryClient(blockchainCfg,"", project);
  await serviceRegistry.startService(serviceID, replicas, secret);
}



async function view(args, cfg){
  const project = cfg.project_path;
  const outputPath = args.file;
  const contextsFile = project+CONTEXTS_FILE;
  const ctFile = JSON.parse(fs.readFileSync(contextsFile));
  const contexts = ctFile.contexts;
  const curID = ctFile['current-context'];
  const context = contexts[curID];
  const scvReg = context.Auth['service-registry'];
  let serviceID = context.ServiceRegistry['id'];

  if(context.ServiceRegistry == null){
    process.exit(1);
  }
  if(args.serviceid != null){
    serviceID = args.serviceid;
  }
  //Check requred option
  if(serviceID == null){
    console.log('There are no services stored in the service registry');
    return;
  }

  const blockchainCfg = {'account': scvReg.account, 'endpoint': scvReg.endpoint}
  const serviceRegistry =  await _getServiceRegistryClient(blockchainCfg, "", project);
  await serviceRegistry.view(serviceID, outputPath);
}



async function register(args, cfg){
  const serviceFilePath = args.file;
  const password = args.password;
  const project = cfg.project_path;

  //Check requred option
  if(serviceFilePath == null){
    console.log('This command requires the -f or --file options');
    return;
  }
  if(serviceFilePath == true){
    console.log('Require service file path');
    return;
  }
  if(password == null){
    console.log('This command requires the -p or --password options');
    return;
  }
  if(password == true){
    console.log('Require password');
    return;
  }

  const contextsFile = project+CONTEXTS_FILE;
  const ctFile = JSON.parse(fs.readFileSync(contextsFile));
  const contexts = ctFile.contexts;

  if(contexts.length == 0){
    console.log('There is no context for this project');
    return;
  }

  const curID = ctFile['current-context'];
  const context = contexts[curID];
  const scvReg = context.Auth['service-registry'];
  if(scvReg==null){
    console.log('This command must be preceded by add-service-registry');
    return;
  }

  const readed = fs.readFileSync(serviceFilePath, {encoding: 'utf8'});
  const serviceFile = YAML.parse(readed);
  const serviceInfo = serviceFile.Service;
  const serviceRegistry =  await _getServiceRegistryClient(scvReg, password, project);
  const spinner = ora('Start register').start();
  setTimeout(() => {
    spinner.text = 'Please wait....';
  }, 1000);
  
  const resultCode = await serviceRegistry.register(serviceInfo, context);
  if(resultCode == 200){
    spinner.succeed('Successful');
    serviceInfo['manager-account'] = scvReg.account;
    serviceInfo['blockchain-endpoint'] = scvReg.endpoint;
    ctFile.contexts[curID].ServiceRegistry = serviceInfo;
    const content = JSON.stringify(ctFile, null, 2);
    fs.writeFileSync(contextsFile, content);
    exit(1);
  }
  return;
}



async function _getServiceRegistryClient(blockchainCfg, password, project){
  blockchainCfg.password = password;
  _checkBlockchainConfig(blockchainCfg);
  const serviceRegistryClient = new ServiceRegistryClient(project, blockchainCfg);
  await serviceRegistryClient.init();
  return serviceRegistryClient;
}



function _checkBlockchainConfig(config){
  const endpoint = config.endpoint;
  const account = config.account;
  const validUrl = require('valid-url');

  if (!validUrl.isUri(endpoint)){
    console.log('Blockchain endpoint is invalid');
    exit(1);

  }
  if(!_isAddress(account)){
    console.log('Blockchain account is invalid');
    exit(1);
  }
}



function _isAddress(address) {
  if (!/^(0x)?[0-9a-f]{40}$/i.test(address)) {
      // check if it has the basic requirements of an address
      return false;
  } else if (/^(0x)?[0-9a-f]{40}$/.test(address) || /^(0x)?[0-9A-F]{40}$/.test(address)) {
      // If it's all small caps or all all caps, return true
      return true;
  } else {
      // Otherwise check each case
      return isChecksumAddress(address);
  }
};
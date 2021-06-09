/**
 * About k8s command 
 */

const CONTEXTS_FILE = '/util/k8s/contexts.json';
const IMAGE_AUTH = '/util/k8s/template/secret/auth.json'
const K8sClient = require('./k8s-client');
const fs = require('fs');
const Base64 = require('js-base64').Base64;
const randomWord = require('random-word');
const check_config = require('./check_config');
const { exit } = require('process');
const chalk = require('chalk');


/*MAIN*/
module.exports = async function(type, args){
    const cfg = check_config();

    switch(type){
      case 'test':
        test(args, cfg);
        break; 
      case 'secret':
        setSecret(args, cfg);
        break;
      case 'rms':
        removeSecrets(args, cfg);
        break;
      case 'spray':
        await spary(args, cfg);  
        break;
      case 'state':
        await state(args, cfg);  
        break;
      case 'recovery':
        recovery(args, cfg);
        break;
      case 'add':
        await add(args, cfg);
        break;
      case 'reduce':
        await reduce(args, cfg);
        break;
      case 'pause':
        await pause(args, cfg);  
        break;        
      default:
        console.log('This command is not supported');
        break;
    }
}




/*br2k reduce -r 3*/
async function reduce(args,cfg){
  let projectPath = cfg.project_path;
  let contextsFile = projectPath+CONTEXTS_FILE;
  let readed = fs.readFileSync(contextsFile);
  let ctFile = JSON.parse(readed);
  let curContextID = ctFile['current-context'];
  let curContext = ctFile.contexts[curContextID];
  let deployment = curContext.Deployment;
  let check = Object.keys(deployment);

  if(check.length == 0){
    console.log('no apps currently deployed');
    exit(1);
  }

  const reduceReplicas = args.replicas;
  const serviceName = deployment['service-name'];
  const curReplicas = parseInt(deployment['replicas']);

  if(curReplicas < reduceReplicas){
    console.log('The number to reduce is greater than the number of current deployed');
    exit(1);
  }
  if(curReplicas-reduceReplicas < 3){
    console.log("It can't be reduced any more..you would rather pause the service");
    exit(1);
  }

  const k8sClient = _createK8sClient(cfg.project_path);
  console.log(serviceName)
  const reduceResult = await k8sClient.reduceReplicas(serviceName, curReplicas, reduceReplicas);
  if(reduceResult.msg!=''){
    console.log(chalk.redBright('reduce failed!\n'));
    console.log(reduceResult.msg);
  }
  
  deployment['replicas'] = reduceResult.curReplicas;
  deployment['updated-time'] = _getCurrentTime();
  ctFile.contexts[curContextID].Deployment = deployment;
  const newContent = JSON.stringify(ctFile, null, 2);
  fs.writeFileSync(contextsFile, newContent);
}




/*br2k add -r 3*/
async function add(args, cfg){
  let projectPath = cfg.project_path;
  let contextsFile = projectPath+CONTEXTS_FILE;
  let readed = fs.readFileSync(contextsFile);
  let ctFile = JSON.parse(readed);

  let curContextID = ctFile['current-context'];
  let curContext = ctFile.contexts[curContextID];
  let deployment = curContext.Deployment;
  let check = Object.keys(deployment);
  if(check.length == 0){
    console.log('no apps currently deployed');
    exit(1);
  }

  const addReplicas = parseInt(args.replicas);
  const maxReplicas = curContext.Cluster.maxReplica;
  const serviceName = deployment['service-name'];
  const curReplicas = parseInt(deployment['replicas']);
  const secret = deployment['secret'];
  const image = deployment['images'];
  const serviceMount = deployment['serviceMount'];
  const availableReplicas = (maxReplicas-curReplicas);

  if(availableReplicas == 0 || availableReplicas < addReplicas){
    console.log('You have exceeded the number of replicas that can be deploy!');
    exit(1);
  }

  const k8sClient = _createK8sClient(cfg.project_path);
  const addResult = await k8sClient.addReplicas(serviceName, curReplicas, addReplicas, image, secret, serviceMount);
  if(addResult.msg!=''){
    console.log(chalk.redBright('Add failed!\n'));
    console.log(msg);
  }

  deployment['replicas'] = addResult.curReplicas;
  deployment['updated-time'] = _getCurrentTime();
  ctFile.contexts[curContextID].Deployment = deployment;
  const newContent = JSON.stringify(ctFile, null, 2);
  fs.writeFileSync(contextsFile, newContent);
}




/*br2k recovery*/
async function recovery(args, cfg){
  let projectPath = cfg.project_path;
  let contextsFile = projectPath+CONTEXTS_FILE;
  let readed = fs.readFileSync(contextsFile);
  let ctFile = JSON.parse(readed);

  let curContextID = ctFile['current-context'];
  let curContext = ctFile.contexts[curContextID];
  let deployment = curContext.Deployment;
  let check = Object.keys(deployment);
  if(check.length == 0){
    console.log('no apps currently deployed');
    return;
  }

  const serviceName = deployment['service-name'];
  const replicas = deployment['replicas'];
  const secret = deployment['secret'];
  const image = deployment['image'];
  const serviceMount = deployment['serviceMount'];

  const k8sClient = _createK8sClient(cfg.project_path);
  const stateResult = await k8sClient.getFailedPodsIndex(serviceName, replicas);

  if(stateResult.msg != ''){
    console.log(stateResult.msg);
    return;
  }

  const failedPodsIndex = stateResult.failedList;
  if(failedPodsIndex.length == 0){
    console.log(chalk.yellow('There is nothing to recover'));
    return;
  }

  await k8sClient.recoveryPods(serviceName, failedPodsIndex, image, secret, serviceMount, replicas);
}

/*br2k pause*/
async function pause(args, cfg){
  let projectPath = cfg.project_path;
  let contextsFile = projectPath+CONTEXTS_FILE;
  let readed = fs.readFileSync(contextsFile);
  let ctFile = JSON.parse(readed);
  let curContextID = ctFile['current-context'];
  let curContext = ctFile.contexts[curContextID];
  let deployment = curContext.Deployment;

  let check = Object.keys(deployment);
  if(check.length == 0){
    console.log('no apps currently deployed');
    return;
  }
  let serviceName = deployment['service-name'];
  let replicas = deployment['replicas'];
  const k8sClient = await _createK8sClient(cfg.project_path);
  const result = await k8sClient.pause(serviceName, replicas);
  if(result == 1){
    ctFile.contexts[curContextID].Deployment = {};
    const newContent = JSON.stringify(ctFile, null, 2);
    fs.writeFileSync(contextsFile, newContent);
    console.log('Deployed app paused!');
  }
}

/*br2k state*/
async function state(args, cfg){
  let projectPath = cfg.project_path;
  let contextsFile = projectPath+CONTEXTS_FILE;
  let readed = fs.readFileSync(contextsFile);
  let ctFile = JSON.parse(readed);
  let curContextID = ctFile['current-context'];
  let curContext = ctFile.contexts[curContextID];
  let deployment = curContext.Deployment;

  let check = Object.keys(deployment);
  if(check.length == 0){
    console.log('no apps currently deployed');
    return;
  }

  let serviceName = deployment['service-name'];
  let replicas = deployment['replicas'];
  const k8sClient = _createK8sClient(cfg.project_path);
  await k8sClient.state(serviceName, replicas);
}

/*br2k spary*/
async function spary(args, cfg){
  let image = args.image;
  let replicas = args.replicas;
  let secret = args.secret;
  let addScv = args.add;
  let serviceMount = args.servicemount;
  let projectPath = cfg.project_path;
  let contextsFile = projectPath+CONTEXTS_FILE;
  let readed = fs.readFileSync(contextsFile);
  let ctFile = JSON.parse(readed);
  let curContextID = ctFile['current-context'];
  let serviceRegistry = ctFile.contexts[curContextID].ServiceRegistry;

  if(serviceRegistry == null){
    console.log('There are no services stored in the service registry');
    exit(1);
  }

  if(image == null){
    console.log('This command requires the -i or --image options');
    exit(1);
  }

  if(replicas == null){
    console.log('This command requires the -r or --replicas options');
    exit(1);
  }

  let name = ctFile.contexts[curContextID].ServiceRegistry.id;
  let deployment = ctFile.contexts[curContextID].Deployment;
  if(Object.keys(deployment) > 0){
    console.log('The app is currently deployed in the context of this projectd');
    exit(1);
  }

  const k8sClient = await _createK8sClient(cfg.project_path);

  const info = {
    image: image,
    replicas: replicas,
    secret: secret,
    name: name,
    mount: serviceMount,
    add:addScv
  };

  const result = await k8sClient.spray(info);
  if(result == 1){
    let deployment = ctFile.contexts[curContextID].Deployment;
    deployment['images'] = image;
    deployment['service-name'] = name;
    deployment['secret'] = secret;
    deployment['replicas'] = replicas;
    deployment['serviceMount'] = serviceMount;
    deployment['start-time'] = _getCurrentTime();
    ctFile.contexts[curContextID].Deployment = deployment;
    const newContent = JSON.stringify(ctFile, null, 2);
    fs.writeFileSync(contextsFile, newContent);
  }else{
    console.log('Failed spray in k8s');
    exit(1);  
  }
}

/*br2k rm-secret*/
async function removeSecrets(args, cfg){
  const target = args.secretname;
  const all = args.allsecret;
  const projectPath = cfg.project_path;
  const contextsFile = projectPath+CONTEXTS_FILE;
  const k8sClient = _createK8sClient(cfg.project_path);

  let readed = fs.readFileSync(contextsFile);
  let ctFile = JSON.parse(readed);
  let curContextID = ctFile['current-context'];
  let curContext = ctFile.contexts[curContextID];
  let curSecrets = curContext['Secrets'];
  
  const secrets = _searchSecret(curSecrets, target, all)

  if(all == true ){
    for(let i=0; i<secrets.length; i++){
      const secret = secrets[i];
      const name = secret.name;
      const registry = secret.registry;
      const user = secret.user;
      const result = await k8sClient.removeSecret(name);

      if(result == 1) delete curSecrets[registry][user];
      else console.log(`Failed to delete ${name} secret`);

      const userList = Object.keys(curSecrets[registry])
      const userSize = userList.length;
      if(userSize==0) delete curSecrets[registry];
    }
    ctFile.contexts[curContextID]['Secrets'] = curSecrets;
    const newContent = JSON.stringify(ctFile, null, 2);
    fs.writeFileSync(contextsFile, newContent);
    return;
  }

  if(secrets.length == 0){
    console.log(`Secret ${target} not found in current context`);
  }else{
    const name = secrets[0].name;
    const result = await k8sClient.removeSecret(name);
    if(result == 1){
      const registry =secrets[0].registry;
      const user = secrets[0].user;
      delete curSecrets[registry][user];
      ctFile.contexts[curContextID]['Secrets'] = curSecrets;
      const newContent = JSON.stringify(ctFile, null, 2);
      fs.writeFileSync(contextsFile, newContent);
    }
  }
}


/*br2k test-spary*/
function test(args, cfg){
  const image = args.image;
  const isEnd = args.end;
  const secret = args.secret;
  const k8sClient = _createK8sClient(cfg.project_path);


  if(isEnd==true){
    k8sClient.endTest()
    return
  }

  if(image == null){
    console.log('This command requires the -i or --image options');
    return;
  }

  if(image == true){
    console.log('Image is not valid');
    return;
  }
  k8sClient.testDepoly(image, secret);
}

/*br2k secret*/
async function setSecret(args, cfg){
  
  let projectPath = cfg.project_path;
  let contextPath = projectPath+CONTEXTS_FILE;  
  let readed = fs.readFileSync(contextPath);
  let info = JSON.parse(readed);
  let curContextID = info['current-context'];
  let curContext = info['contexts'][curContextID];
  let registryInfo = curContext.Auth['image-registry'];
  let remote = registryInfo.endpoint;
  let id = registryInfo.user;
  let pw = args.password;
  let contextsFile = projectPath+CONTEXTS_FILE;
  let name = args.secretname;
  
  if(remote == null){
    console.log('This command must be preceded by add-image-registry');
    return;
  }
  if(id == null){
    console.log('This command must be preceded by add-image-registry');
    return;
  }
  if(pw == null){
    console.log('This command requires the -p or --password options');
    return;
  }
  if(remote == null || id == null || pw == null){
    console.log('The option value for this command is missing');
    return;
  }
  if(name == null){
    name = randomWord();
  }


  const secrets = curContext['Secrets'];
  const remoteSecret = secrets[remote];
  if(remoteSecret != null && remoteSecret[id] != null){
    console.log('This authentication info already exists: '+remoteSecret[id]);
    exit(1);
  }

  let readed_auth = fs.readFileSync(projectPath+IMAGE_AUTH);
  let auth_file = JSON.parse(readed_auth);
  auth_file.auths['https://'+remote] = {username: id,password: pw,}

  let auth_decoded = await Base64.encode(JSON.stringify(auth_file));


  let k8sClient = await _createK8sClient(projectPath);
  let resultCode = await k8sClient.createSecret(auth_decoded, name);

  if(resultCode == 1){
    if(curContext['Secrets'][remote] == undefined){
      curContext['Secrets'][remote] = new Object;
    }
    curContext['Secrets'][remote][id] = name;
    info['contexts'][curContextID] = curContext;
    const newContent = JSON.stringify(info, null, 2);
    fs.writeFileSync(contextsFile, newContent);
    console.log(chalk.greenBright('sucessful-create-secret'));
  }
}


function _createK8sClient(projectPath){
  const contextsFile = projectPath+CONTEXTS_FILE;
  const readed = fs.readFileSync(contextsFile);
  const ctFile = JSON.parse(readed);
  const curContextID = ctFile['current-context'];
  const curContext = ctFile.contexts[curContextID];
  const selectedServerIndex = curContext.Context['current-connect-index'];
  const k8sClient = new K8sClient(curContext, curContextID, projectPath, selectedServerIndex);
  return k8sClient
}


function _searchSecret(secrets, target, allMode){
  const registrys = Object.keys(secrets);
  let results = new Array;


  for(let i = 0; i<registrys.length ; i++){
    const registry = registrys[i];
    const secretsInfo = secrets[registry];
    const users = Object.keys(secretsInfo);

    for(let j  = 0; j<users.length; j++){
      const user = users[j];
      const secretName = secretsInfo[user];

      if(allMode == undefined){
        if(secretName == target){
          results.push({name: secretName,registry: registry, user: user});
          return results;
        }
      }
      else{ results.push({name: secretName,registry: registry, user: user}); }
    }
  }
  return results
}

function _getCurrentTime(){
  const date_ob = new Date();

  const createTime = date_ob.getFullYear() 
  + "-" + ("0" + (date_ob.getMonth() + 1)).slice(-2)
  + "-" + ("0" + date_ob.getDate()).slice(-2)
  + " " + date_ob.getHours() 
  + ":" + date_ob.getMinutes()
  + ":" + date_ob.getSeconds();
  return createTime
}


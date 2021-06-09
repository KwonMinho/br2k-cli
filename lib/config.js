/**
 * About k8s config command 
 */


const CONTEXTS_FILE = '/util/k8s/contexts.json';



const fs = require('fs');
const shell = require('shelljs');
const YAML= require('yaml');
const HASH = require('object-hash');
const jwtDecode = require('jwt-decode');
const randomWord = require('random-word');
const { printTable } = require('console-table-printer');
const check_config = require('./check_config');
const chalk = require('chalk');
const { exit } = require('process');
const axios = require('axios');



/*MAIN*/
module.exports = function(type, args){
    let cfg;
    if(args!='init') cfg = check_config();

    switch(type){
      case 'init':
        init(args, cfg);
        break;
      case 'ask-context':
        askContext(args, cfg);
        break;
      case 'context':
        context(args, cfg);
        break;
      case 'add-image-registry':
        addImageRegistry(args, cfg);
        break;
      case 'add-service-registry':
        addServiceRegistry(args, cfg);
        break;
      case 'current':
        current(args,cfg);
        break;
      case 'list':
        list(args, cfg);
        break;
      case 'change':
        change(args, cfg);
        break;
      case "change-k8s-server":
        changeK8sServer(args, cfg);
        break;
      case 'test':
        test(args, cfg);  
        break;
      case 'rmc':
        remove(args, cfg);  
        break;
      default:
        console.log('This command is not supported');
        break;
    }
}


/*br2k change-k8s-server*/
function changeK8sServer(args, cfg){

  const selectedIndex = Number(args.index);
  const contextsFilePath = cfg.project_path+CONTEXTS_FILE;
  const ctFile = JSON.parse(fs.readFileSync(contextsFilePath));
  const curID = ctFile['current-context'];
  const curContext  = ctFile.contexts[curID]

  //Check requred option
  if(selectedIndex == null){
    console.log('This command requires the -i or --index options');
    return;
  }
  if(typeof selectedIndex != 'number' ){
    console.log('Type of index options is number!');
    return;
  }

  curContext.Context['current-connect-index'] = selectedIndex;
  ctFile.contexts[curID] = curContext;
  const newContent = JSON.stringify(ctFile, null, 2);
  fs.writeFileSync(contextsFilePath, newContent); 
  console.log(chalk.greenBright('sucessful-change'));
}


/*br2k init*/
function init(args, cfg){
  const currentLocation = process.cwd();
  const br2kFliePath = currentLocation+'/.br2k.json';
  const commandLocation = __dirname+'/..'

  try{
    if(fs.existsSync(br2kFliePath)){
      console.log(chalk.redBright("This project has been initalized => current project path: "+currentLocation));
      return;
    }
  }catch(err){}

  //1. create .br2k.json
  fs.writeFileSync(br2kFliePath, JSON.stringify({
    'project_path': currentLocation
  }))


  //2. check truffle install
  const truffleCheck = shell.exec('truffle 2> /dev/null', {async:false});
  if(truffleCheck.stderr.indexOf('not found')!=-1){
    shell.exec(`sh ${commandLocation}/res/truffle-install.sh > /dev/null`, {async:false});
    console.log(chalk.greenBright("Success installed truffle framework!"));
  }

  //3. init br2k project
  console.log(chalk.yellow("Init br2k project...Please wait..!"));
  shell.exec(`cd ${currentLocation} && truffle init 2> /dev/null > /dev/null`);
  shell.exec(`cd ${currentLocation} && npm init --force 2> /dev/null > /dev/null`);
  shell.exec(`cd ${currentLocation} && npm install br2k-app --save > /dev/null 2> /dev/null`);
  shell.exec(`cp -rf ${commandLocation}/res/util ${currentLocation}`);
  shell.exec(`cp -rf ${commandLocation}/res/.dockerignore ${currentLocation}`);
  shell.exec(`cp -rf ${commandLocation}/res/Dockerfile ${currentLocation}`);
  shell.exec(`cp -rf ${commandLocation}/res/specific-document-example ${currentLocation}`);
  shell.exec(`mkdir ${currentLocation}/server`);
  console.log(chalk.greenBright("Success init br2k project!!"));
}


/*br2k ask-context*/
async function askContext(args, cfg){
  const ca_filePath = args.file;
  const remoteServer = args.remote;

  //Check requred option
  if(ca_filePath == null){
    console.log('This command requires the -f or --file options');
    return;
  }
  if(ca_filePath == true){
    console.log('Require context file path');
    return;
  }

  if(remoteServer == null){
    console.log('This command requires the -r or --remote options');
  }

  const ca_file = YAML.parse(fs.readFileSync(`${ca_filePath}`, {encoding: 'utf8'}));

  const res = await axios.post(remoteServer, {
    'contextAsk': ca_file
  });

  fs.writeFileSync('./context.yaml', YAML.stringify(res.data))
}


/*br2k add-image-registry*/
function addImageRegistry(args, cfg){
  const file = args.file;
  const contextsFile = cfg.project_path+CONTEXTS_FILE;
  const readed = fs.readFileSync(contextsFile);
  const ctFile = JSON.parse(readed);
  const curID = ctFile['current-context'];


  //Check requred option
  if(file == null){
    console.log('This command requires the -f or --file options');
    return;
  }
  if(file == true){
    console.log('Require context file path');
    return;
  }
  const imageRegFile = YAML.parse(fs.readFileSync(`${file}`, {encoding: 'utf8'}));
  ctFile.contexts[curID].Auth['image-registry'] = imageRegFile;
  const newContent = JSON.stringify(ctFile, null, 2);
  fs.writeFileSync(contextsFile, newContent); 
  console.log(chalk.greenBright('sucessful-set'));
}



/*br2k add-service-registry*/
function addServiceRegistry(args, cfg){
  const file = args.file;
  const contextsFile = cfg.project_path+CONTEXTS_FILE;
  const readed = fs.readFileSync(contextsFile);
  const ctFile = JSON.parse(readed);
  const curID = ctFile['current-context'];

  //Check requred option
  if(file == null){
    console.log('This command requires the -f or --file options');
    return;
  }
  if(file == true){
    console.log('Require context file path');
    return;
  }

  const scvRegFile = YAML.parse(fs.readFileSync(`${file}`, {encoding: 'utf8'}));
  ctFile.contexts[curID].Auth['service-registry'] = scvRegFile;
  const newContent = JSON.stringify(ctFile, null, 2);
  fs.writeFileSync(contextsFile, newContent); 
  console.log(chalk.greenBright('sucessful-set'));
}



/*br2k remove-context*/
function remove(args, cfg){
  const target = args.target;
  const contextsFile = cfg.project_path+CONTEXTS_FILE;

  if(target == null){
    console.log('This command requires the -t or --target options');
    return;
  }

  if(target == true){
    console.log('This target is not valid');
    return;
  }

  const readed = fs.readFileSync(contextsFile);
  const ctFile = JSON.parse(readed);
  const contexts = ctFile.contexts;
  const contextID = _searchContextID(target, contexts);
  delete ctFile.contexts[contextID];
  const newContent = JSON.stringify(ctFile, null, 2);
  fs.writeFileSync(contextsFile, newContent);
}


/*br2k change-context*/
function change(args, cfg){
  const target = args.target;
  const contextsFile = cfg.project_path+CONTEXTS_FILE;

  if(target == null){
    console.log('This command requires the -t or --target options');
    return;
  }

  //Read util/k8s/contexts.json
  const readed = fs.readFileSync(contextsFile);
  const ctFile = JSON.parse(readed);
  const contextID = _searchContextID(target, ctFile.contexts);
  ctFile['current-context'] = contextID;
  const newContent = JSON.stringify(ctFile, null, 2);
  fs.writeFileSync(contextsFile, newContent);
}


/*br2k list-context*/
function list(args, cfg){
  const target = args.target;
  const isDetail = args.detail;
  const contextsFile = cfg.project_path+CONTEXTS_FILE;
  const readed = fs.readFileSync(contextsFile);
  const ctFile = JSON.parse(readed);
  const contexts = ctFile.contexts;
  const contextIDs = Object.keys(contexts);


  if(target != null){
    _printContext(target, contexts, isDetail);
    return;
  }

  if(isDetail == true){
    contextIDs.forEach(id=>{
      console.log(contexts[id]);
    })
    return;
  }

  let table = new Array;
  contextIDs.forEach(id => {
    let imgRegEndpoint, scvRegEndpoint;

    if(contexts[id].Auth['image-registry'] == null){
      imgRegEndpoint = 'EMPTY'
    }else{
      imgRegEndpoint = contexts[id].Auth['image-registry'].endpoint
    }

    if(contexts[id].Auth['service-registry'] == null){
      scvRegEndpoint = 'EMPTY'
    }else{
      scvRegEndpoint = contexts[id].Auth['service-registry'].endpoint
    }

    table.push({
      'context-name': contexts[id].Name,
      'k8s-location': contexts[id].Context['api-server'],
      'img-registry': imgRegEndpoint,
      'service-registry': scvRegEndpoint,
    })
  });
  printTable(table);
}


/*br2k current-context*/
function current(args, cfg){
  const contextsFile = cfg.project_path+CONTEXTS_FILE;
  const readed = fs.readFileSync(contextsFile);
  const ctFile = JSON.parse(readed);
  const ctID = ctFile['current-context'];
  const contexts = ctFile.contexts;
  const secrets = args.secrets;
  const endpoints = args.endpoints;
  const registered = args.registered;

  console.log(chalk.blueBright("\nCURRENT CONTEXT"));
  
  _printContext(ctID, contexts,'');



  if(secrets == true){
    console.log(chalk.blueBright('SECRETS IN CURRENT CONTEXT'));
    let table = new Array;
    
    const registryUrls = Object.keys(contexts[ctID].Secrets);
    registryUrls.forEach((url)=>{
      const users = Object.keys(contexts[ctID].Secrets[url]);
      let names = new Array;

      users.forEach((user)=>{
        names.push(contexts[ctID].Secrets[url][user]);
      })
      table.push({
        REGISTRY: url,
        REGISTRY_USERS: users,
        SECRET_NAME: names,
      })
    })
    printTable(table);
  }

  // if(endpoints == true){
  //   console.log(chalk.blueBright('SERVICE-POINTES'));
  //   console.log(contexts[ctID].Cluster['service-points']);
  //   console.log(chalk.blueBright('SERVICE-PORT: ')+contexts[ctID].Cluster['service-port']);
  // }

  if(registered == true){
    if(contexts[ctID].ServiceRegistry['id'] == undefined){
      console.log('\n'+chalk.redBright('[current context] There are no services that registered in service registry '));
      return;
    }
    console.log('\n'+chalk.blueBright('REGISTERED-SERVICE ID: ')+contexts[ctID].ServiceRegistry['id']);
    console.log(chalk.blueBright('ACCOUNT USING SERVICE REGISTER: ')+contexts[ctID].ServiceRegistry['manager-account']);
  }
}


/*br2k set-context*/
function context(args, cfg){
  const contextFile = args.file;
  const contextsFile = cfg.project_path+CONTEXTS_FILE;
  let contextName = args.contextname;


  //Check requred option
  if(contextFile == null){
    console.log('This command requires the -f or --file options');
    return;
  }
  if(contextFile == true){
    console.log('Require context file path');
    return;
  }
  if(contextName == null){
    contextName = randomWord();
  }

  const ctYaml = fs.readFileSync(`${contextFile}`, {encoding: 'utf8'});
  const ct = YAML.parse(ctYaml);

  _checkContextOption(ct);

  const tk = ct['access-token'];
  const apiServer = ct['api-server'];
  const resInfo = ct['assign-resources'];
  const ca_cert = ct['certificate-authority-data'];
  const available_registry = ct['available-registry'];
  const nodeID = resInfo['node-id'];
  const servicePoints = resInfo['service-points'];
  const servicePort = resInfo['service-port'];
  const serviceProtocol = resInfo['service-protocol'];
  const networkID = resInfo['network-id'];
  const nodeMountPath = resInfo['node-mount-path'];
  const serviceMount = nodeMountPath.service;
  const etcdMount = nodeMountPath.etcd;
  const maxReplica = servicePoints.length;

  //Get contextID
  const len = tk.length;
  const tokenID = tk.substring(len-5,len);
  const namespace =  _getNamespace(tk);
  const contextID = HASH.MD5(tokenID+apiServer+namespace);

  //Read util/k8s/contexts.json
  const readed = fs.readFileSync(contextsFile);
  const ctFile = JSON.parse(readed);
  const contexts = Object.keys(ctFile.contexts);

  //Write util/k8s/contexts.json
  if(ctFile.contexts[contextID] != null){
    const alreadyName = ctFile.contexts[contextID].Name;
    console.log(`Already set context: ${alreadyName}`);
    exit(1);
  }
  if(contexts.length == 0){
    ctFile['current-context'] = contextID;
  }

  const context ={
    Name: contextName,
    Context: {
      'api-server': apiServer,
      'current-connect-index': 0,
      'namespace' : namespace,
      'access-token': tk,
    },
    Cluster: {
      'node-id': nodeID,
      'maxReplica': maxReplica,
      'network-id': networkID,
      'service-protocol': serviceProtocol,
      'service-points': servicePoints,
      'service-port': servicePort,
      'node-mount-service': serviceMount,
      'node-mount-etcd': etcdMount, 
      'kubernetes-ca-cert': ca_cert,
      'available-container-registry': available_registry
    },
    Auth:{/* service,image-registry */},
    Secrets: { /*registry: {id:name}*/},
    Deployment: {},
    ServiceRegistry: {}
  }
  ctFile.contexts[contextID] = context;
  const content = JSON.stringify(ctFile, null, 2);
  fs.writeFileSync(contextsFile, content);
  console.log(chalk.greenBright('sucessful-set'));
}

//For context Func
function _getNamespace(token){
  const decoded = jwtDecode(token);
  const keys = Object.keys(decoded);
  let namespace ='';

  keys.forEach(key=>{
    if(key.search('namespace')!= -1){
      namespace = decoded[key];
    }
  });
  if(namespace == ''){
    console.log('This access token is not valid')
    exit(1);
  }
  return namespace;
}

//For context Func
function _checkContextOption(ct){
  const res = ct['assign-resources'];

  if(ct['access-token'] == null){
    console.log('access-token is missing in the context file');
    exit(1);
  }
  if(ct['api-server'] == null){
    console.log('api-server is missing in the context file');
    exit(1);
  }

  if(res['node-id'] == null){
    console.log('The type of endpoints must be an array');
    exit(1);
  }

  if(res['service-points'].constructor != Array){
    console.log('The type of endpoints must be an array');
    exit(1);
  }
  if(res['service-points'].length == 0 || res['service-points'] == null){
    console.log('service-endpoints is missing in the context file')
    exit(1);
  }
  if(res['service-port'] == null){  
    console.log('service-port is missing in the context file')
    exit(1);
  }
  if(res['network-id'] == null){  
    console.log('network-id is missing in the context file')
    exit(1);
  }
}

//For list-context,remove-context Func
function _searchContextID(name, contexts){
  const ctArrary = Object.keys(contexts);
  for(let i=0; i<ctArrary.length; i++){
    const id = ctArrary[i];
    if(contexts[id].Name == name){
      return id;
    }   
  }
  console.log(`This context cannot be found in this project.`);
  exit(1);
}

//For list-context Func
function _printContext(target, contexts, isDetail){
  let context = contexts[target];

  if(context == null){
    const id = _searchContextID(target, contexts);
    context = contexts[id];
  }
  if(context == null){
    console.log(`This context cannot be found in this project.`)
    return;
  }
  if(isDetail == true){
    console.log(context);
    return;
  }

  let table = new Array;
  table.push({
    'context-name': context.Name,
    'k8s-location': context.Context['api-server'],
  })
  printTable(table);

  if(context.Auth['image-registry']!=null){
    table = new Array;
    const regInfo = context.Auth['image-registry'];
    table.push({
      'img-registry': `${regInfo.name}(${regInfo.endpoint})`,
      'img-registry-user': regInfo.user,
    })
    printTable(table);
  }

  if(context.Auth['service-registry']!=null){
    table = new Array;
    table.push({
      'service-registry': context.Auth['service-registry'].endpoint,
      'service-registry-user': context.Auth['service-registry'].account,
    })
    printTable(table);
  }
}

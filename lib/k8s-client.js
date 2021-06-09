const fs = require('fs');
const YAML = require('yaml');
const chalk = require('chalk');
const EtcdClient = require('./etcd-client');
const Client = require('kubernetes-client').Client;
const sleep = require('sleep');
const API_VERSION = '1.13';




module.exports = class K8sClient{

  constructor(context, contextID, proejectPath, selectedServerIndex){
    this._setTemplate(proejectPath);
    this._setTokenClientInfo(context, contextID, selectedServerIndex);
  }


  _setTemplate(projectPath){
    const templatePath = projectPath + '/util/k8s/template/';
    const readList = ['pod', 'test-pod','/secret/secret'];
    readList.forEach((obj)=>{
      const objYaml = fs.readFileSync(`${templatePath}${obj}.yaml`, {encoding: 'utf8'});
      const objContent = YAML.parse(objYaml);
      this[obj] = objContent;
    });
  }


  _getEtcdClient(urls, curReplicas){
    const etcdClient = new EtcdClient(urls, curReplicas);
    return etcdClient;
  }


  _setTokenClientInfo(ct, ctID, selectedServerIndex){
    this.contextID = ctID;
    this.apiServer = ct.Context['api-server'];
    this.namespace = ct.Context['namespace'];
    this.token = ct.Context['access-token'];
    this.maxReplica = ct.Cluster['maxReplica'];
    this.nodeID = ct.Cluster['node-id'];
    this.servicePoints = ct.Cluster['service-points'];
    this.servicePort = ct.Cluster['service-port'];
    this.networkID = ct.Cluster['network-id'];
    this.volumes = ct.Cluster['volumes']; //@FIX
    this.caCert = ct.Cluster['kubernetes-ca-cert'];
    this.availableRegistry = ct.Cluster['available-container-registry'];

    if(selectedServerIndex==null) selectedServerIndex=0;

    let config = {
      url: this.apiServer[selectedServerIndex],
      request: {
        auth: {bearer: this.token},
      },
    };

    if(this.caCert == null){
      config['insecureSkipTlsVerify'] = true;
    }else{
      //ca-cert-client
      console.log('CHHHHHHHEEEEEKK: /lib/k8s-client  _setTokenClientInfo()');
    }
    this.k8s = new Client({config, version: API_VERSION});
  }


  /*br2k pause*/
  async pause(serviceName, replicas){
    let resultCode = -1;
    for(let i=1; i<=replicas ; i++){
      try{
        const result = await this.k8s.api.v1.namespaces(this.namespace).pods(serviceName+i).delete();
        if(result.statusCode == 200){
          resultCode = 1;
        }
      }catch(e){
        console.log(e);
      }
      if(i==replicas) return resultCode;
    }
  }


  /*br2k reduce -r*/
  async reduceReplicas(serviceName, curReplicas, reduceReplicas){
    for(let i=1; i <= reduceReplicas; i++){
      try{
        const etcdClient = this._getEtcdClient(this.servicePoints, curReplicas);
        const removeErr = await etcdClient.removeMember();
        if(removeErr!='') 
          return {msg: removeErr, curReplicas: curReplicas};

        const curPodName = serviceName+(curReplicas);
        const removeResult = await this.k8s.api.v1.namespaces(this.namespace).pods(curPodName).delete();
        
        if(removeResult.statusCode == 200){
          --curReplicas;
          console.log(chalk.green(`Successfully delete pod: ${curPodName}`));
        }else{
          return {msg: 'Pod delete Error!', curReplicas: curReplicas};
        }

        if(i == reduceReplicas)  
          return {msg: '', curReplicas: curReplicas};

        if(reduceReplicas > 1){
          console.log(chalk.grey(`The next adding takes 5 seconds..Please wait!\n`));
          sleep.sleep(5);
        }
      }catch(e){
        return {msg: e, curReplicas: curReplicas};
      }
    }
  }


  /*br2k add -r*/
  async addReplicas(serviceName, curReplicas, addReplicas, image, secret, serviceMount){
    for(let i=1; i <= addReplicas; i++){
      try{
        const etcdClient = await this._getEtcdClient(this.servicePoints, curReplicas);
        const addErr = await etcdClient.addMember();
        
        if(addErr!='') 
          return {msg: addErr, curReplicas: curReplicas}

        ++curReplicas;
        const pod = this._createPodTemplate(serviceName, curReplicas, image, secret, serviceMount, curReplicas, true);
        const deplopResult = await this.k8s.api.v1.namespaces(this.namespace).pods.post({body: pod});
        if(deplopResult.statusCode == 201)
          console.log('\n'+chalk.greenBright(`add the ${serviceName+(curReplicas)} pod`));
        
        if(i == addReplicas)  
          return {msg: '', curReplicas: curReplicas};

        if(addReplicas > 1){
          console.log(chalk.grey(`The next adding takes 15 seconds..Please wait!\n`));
          sleep.sleep(15);
        }
      }catch(e){
        return {
         msg: e,
         curReplicas: curReplicas
        };
      }
    }
  }

  /*br2k recovery-step2*/
  async recoveryPods(serviceName, failedPodsIndex, image, secret, serviceMount, replicas){
    for(let i=0; i<failedPodsIndex.length ; i++){
      try{
        //step1: remove etcd member
        const curFailedIndex = failedPodsIndex[i];
        const etcdClient = this._getEtcdClient(this.servicePoints, replicas);
        const removeErr = await etcdClient.removeTargetMember(curFailedIndex);
        if(removeErr!='') 
          return {msg: removeErr, curReplicas: replicas};

        //step2: remove the pod
        const curPodName = serviceName+curFailedIndex;
        const removeResult = await this.k8s.api.v1.namespaces(this.namespace).pods(curPodName).delete();
        
        if(removeResult.statusCode == 200){
          console.log(chalk.green(`Successfully delete failed pod: ${curPodName}`));
          console.log(chalk.grey(`The next adding takes 20 seconds..Please wait!\n`));
          sleep.sleep(20);
        }else{
          console.log(chalk.red("Failed to recovery: Can't delete failed service"));
          return;
        }

        //step3: add etcd member
        const addErr = await etcdClient.addTargetMember(curFailedIndex);
        if(addErr!='') 
          return {msg: addErr, curReplicas: replicas}

        //step2: spray
        const pod = this._createPodTemplate(serviceName, curFailedIndex, image, secret, serviceMount, replicas, true);
        const deplopResult = await this.k8s.api.v1.namespaces(this.namespace).pods.post({body: pod});
        if(deplopResult.statusCode == 201){
          console.log('\n'+chalk.greenBright(`Redeployment to the ${curPodName} pod`));
        }
      }catch(e){
        console.log(e);
      }
    }
  }

  /*br2k recovery-step1*/
  async getFailedPodsIndex(serviceName, replicas){
    let failedPodIndexs = [];

    for(let i=1; i<=replicas ; i++){
      try{
        const result = await this.k8s.api.v1.namespaces(this.namespace).pods(serviceName+i).get();
        if(result.statusCode == 200){
          const pod = result.body;
          if(pod.status.phase != 'Running'){
            failedPodIndexs.push(i);
          }else{
            for(let j=0; j<pod.status.conditions.length; j++){
              const stateObj = pod.status.conditions[i];
              if(stateObj.status == 'False'){
                failedPodIndexs.push(i);
                break;
              }            
            }
          }  
        }else{
          return { msg: 'Failed to read service state', failedList: []};
        }
      }catch(e){
        console.log(e);
        return { msg: e, failedList: []};
      }
    }


    return { msg: '', failedList: failedPodIndexs};
  }




  /*br2k state*/
  async state(serviceName, replicas){
    for(let i=1; i<=replicas ; i++){
      try{
        const result = await this.k8s.api.v1.namespaces(this.namespace).pods(serviceName+i).get();
        if(result.statusCode == 200){
          const pod = result.body;  
          await this._printPodState(pod,i);
        }
      }catch(e){
        console.log(e);
      }
    }
    return;
  }



  /*br2k spray*/
  async spray(info){
    const image = info.image;
    const replicas = info.replicas;
    const secret = info.secret;
    const name = info.name;
    const serviceMount = info.mount
    const addScvPath = info.add;

    for(let i=1; i<=replicas; i++){
      try{
        const pod = this._createPodTemplate(name, i, image, secret, serviceMount, replicas, false, addScvPath);
        const result = await this.k8s.api.v1.namespaces(this.namespace).pods.post({body: pod});
        if(result.statusCode == 201){
          console.log('\n'+chalk.greenBright(`Deployment to the ${i} node is success`));
        }
      }catch(e){
        console.log('\n'+chalk.redBright(`Deployment to the ${i} node is failed`));
        console.log(e);
        return -1;
      }
    }
    return 1;
  }


  /*br2k rm-secret*/
  async removeSecret(name){
    try{
      const result = await this.k8s.api.v1.namespaces(this.namespace).secrets(name).delete();
      const statusCode = result.statusCode;
      if(statusCode == 200){
        return 1;
      }
    }catch(e){
      console.log("ERROR REMOVE SECRET");
      console.log(e);
      return -1;
    }
  }

  /*br2k secret*/
  async createSecret(auth, name){
    let secretYAML = this['/secret/secret'];
    secretYAML.metadata.name = name;
    secretYAML.metadata.namespace = this.namespace;
    secretYAML.data['.dockerconfigjson'] = auth;

    try{
      const result = await this.k8s.api.v1.namespaces(this.namespace).secrets.post({body: secretYAML});
      const statusCode = result.statusCode;
      if(statusCode == 201){
        return 1
      }
    }catch(e){
      console.log("ERROR CREATE SECRET")
      console.log(e);
    }
  }

  /*br2k test -e*/
  async endTest(){
    for(let i=0; i<this.maxReplica ; i++){
      const nodeIndex = (i+1);
      try{
        const podName = this.contextID+nodeIndex;
        const result = await this.k8s.api.v1.namespaces(this.namespace).pods(podName).delete();
        if(result.statusCode == 200){
          console.log(chalk.green(`Successfully delete test pods from this ${nodeIndex} node`));
        }
      }catch(e){
        if(e.code == 404){
          console.log(chalk.red(`No test pods exist on ${nodeIndex} node`));
        }
      }
    }
  }

  /*br2k test -i*/
  async testDepoly(image, secret){
    const failedList = await this._isING_TestDeploy();
    let pod = this['test-pod'];
    let label = this.nodeID;
    let name = this.contextID;
    let deployResults = new Array;
    let failedNumber = failedList.length;

    for(let i=0; i<failedNumber; i++){
      let nodeNumber = failedList[i];
      pod.metadata.name = name+nodeNumber;
      pod.spec.containers[0].name = name+nodeNumber;
      pod.spec.containers[0].image = image;
      pod.spec.nodeSelector = new Object;
      pod.spec.nodeSelector[label] = nodeNumber.toString;
      if(secret!=null)
        pod.spec.imagePullSecrets[0].name = secret;
      try{
        const result = await this.k8s.api.v1.namespaces(this.namespace).pods.post({body: pod});
        if(result.statusCode == 201) deployResults.push(nodeNumber);
      }catch(e){
        console.log(chalk.red(`Test deployment to the ${nodeNumber} node is Failed`))
        console.log(e);
      }
    }
    deployResults.forEach(nodeIndex=>{
      console.log(chalk.green(`Successful deployment to the ${nodeIndex} node`));
    })
  }


  /*For: br2k spray, recovery*/
  _createPodTemplate(name, podIndex, image, secret, serviceMount, replicas, isAddMode, addScvPath){
    let selector = this.networkID;
    let initialCluster = this._initialClusterETCD(replicas)
    let pod = this['pod']
    let curIndex = podIndex;

    //metadata part
    let metadata = pod.metadata;
    metadata.labels = new Object;
    metadata.labels[selector] = curIndex.toString();
    metadata.name = name+curIndex.toString();
    pod.metadata = metadata;

    //spec.containers SERVICE part
    let containers = pod.spec.containers;
    let scvContainer = containers[1];
    scvContainer.image = image;
    for(let i=0; i< this.servicePort.length; i++){
      scvContainer.ports[i].name = 'port-'+i;
      scvContainer.ports[i].containerPort = this.servicePort[i];      
    }
    containers[1] = scvContainer;

    //volumes: etcd-repo, service-repo
    //////////////////////@FIX volume -> (etcd or service)-(type)-(info)
    const etcdNodeMount = null;
    const serviceNodeMount = null;

    if(serviceMount != null && serviceNodeMount != null){
      scvContainer.volumeMounts = new Array;
      scvContainer.volumeMounts[0] = new Object;
      scvContainer.volumeMounts[0].mountPath = serviceMount;

      if(pod.spec.volumes == null) pod.spec.volumes = new Array;

      pod.spec.volumes[1] = new Object;
      pod.spec.volumes[1].name = 'scv-repo';
      pod.spec.volumes[1].hostPath.path = serviceNodeMount;    
    }
    //spec.containers ETCD part
    let etcdContainer = containers[0];
    if(etcdNodeMount != null){
      etcdContainer.volumeMounts = new Array;
      etcdContainer.volumeMounts[0] = new Object;
      etcdContainer.volumeMounts[0].name = 'etcd-repo'
      etcdContainer.volumeMounts[0].mountPath = '/var/run/etcd';

      if(pod.spec.volumes == null) pod.spec.volumes = new Array;
      pod.spec.volumes[0] = new Object;
      pod.spec.volumes[0].name = 'etcd-repo';
      pod.spec.volumes[0].hostPath.path = etcdNodeMount;
    }
    ////////////////////////////////////////////////////////

    let etcdArg = etcdContainer.command;
    const etcdName = `etcd${curIndex}`;
    const curUrl = this.servicePoints[curIndex-1];
    etcdArg[2] = etcdName;
    etcdArg[4] = `http://${curUrl}:2380`;
    etcdArg[10] = `http://${curUrl}:2379`;
    etcdArg[12] = initialCluster;
    if(isAddMode){
      etcdArg[14] = 'existing';
    }
    containers[0].command = etcdArg;

    //add other contianer service
    if(addScvPath != null){
      const readObj= fs.readFileSync(addScvPath,{encoding: 'utf8'});
      containers[2] = YAML.parse(readObj);
    }

    //add spec.containers containers
    pod.spec.containers = containers;

    //spec.nodeSelector
    const lable = this.nodeID;
    pod.spec.nodeSelector = new Object;
    pod.spec.nodeSelector[lable] = curIndex.toString();

    //spec.imagePullSecrets
    if(secret != null){
      pod.spec.imagePullSecrets = new Array;
      pod.spec.imagePullSecrets[0] = new Object;
      pod.spec.imagePullSecrets[0].name = secret;
    }
    return pod;
  }


  /*For: br2k test -i*/
  async _isING_TestDeploy(){
    try{
      const result = await this.k8s.api.v1.namespaces(this.namespace).pods.get();
      const pods = result.body.items;
      const stateNodes = new Map;
      const faileds = new Array;

      for(let i=0; i<this.maxReplica; i++){
        const nodeIndex = (i+1)+'';
        stateNodes.set(nodeIndex, -1);
      }

      pods.forEach((pod)=>{
        const name = pod.metadata.name;
        if(name.match(this.contextID) != null){
          const nodeIndex = name.replace(this.contextID,"");
          const podState = pod.status.phase;

          stateNodes.set(nodeIndex, 1);
          if(podState == 'Running'){
            console.log('Node-'+nodeIndex,' : '+chalk.green('Pod status is Running'));
          }else if(podState == 'Pending'){
            console.log('Node-'+nodeIndex,' : '+chalk.red('Pod status is Pending'));
            console.log(pod.status.containerStatuses[0].state);
            console.log("   ");
          }
        }
      });
      for(let i=0; i<this.maxReplica; i++){
        const nodeIndex = (i+1)+'';
        const deployState = stateNodes.get(nodeIndex);
        if(deployState == -1){
          faileds.push(nodeIndex);
        }
      }
      return faileds;
    }catch(e){
      console.log(e);
    }
  }

  /*For: br2k spray*/
  _initialClusterETCD(replicas){
    let arg = '';
    let urls = this.servicePoints;

    for(let i=0; i<replicas-1; i++){
      arg += `etcd${i+1}=http://${urls[i]}:2380,`;
    }
    arg += `etcd${replicas}=http://${urls[replicas-1]}:2380`;

    return arg;
  }


  /*For: br2k state*/
  _printPodState(pod, index){

    if(pod.status.phase != 'Running'){
      console.log('\n'+chalk.redBright(`Service${index}`));
      console.log(pod.status.conditions)
    }else{
      console.log('\n'+chalk.greenBright(`Service${index}`));
      console.log(`   NAME:  ${pod.metadata.name}`);
      let healthCnt = 0;
      pod.status.conditions.forEach((stateObj)=>{
        if(stateObj.status == 'False'){
          console.log(`   REASON: ${stateObj.reason}`);
          console.log(`   MESSAGE: ${stateObj.message} \n`);
        }else ++healthCnt;
      });

      if(healthCnt == 4){
        console.log(`   STATE: ${pod.status.phase}`);
      }else{
        console.log(`   STATE: ${chalk.redBright('Unhealth \n')}`);
      }
    }  
  }


}

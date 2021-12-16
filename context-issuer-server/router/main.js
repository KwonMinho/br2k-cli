const KubeClient = require('../lib/k8s-client');
const k8sCfg = require('../config/k8s');
const k8s = require('../config/k8s');
const k8sClient = new KubeClient(k8sCfg);



/**
 * dev log :
 * 1. del context
 * kubectl delete clusterrolebindings NAMESPACE-binding-REPLICAS
 * kubectl delete namespace NAMESPACE
 */
exports.router = (app) => {

  app.post('/context', async (req, res)=>{
    let {contextAsk, userDID, pubKeyID, signature} = {
        contextAsk: req.body.contextAsk,
        userDID: req.body.did,
        pubKeyID: `${req.body.did}#${req.body.keyid}`,
        signature: req.body.signature,
    };

    //@add check identity of deployer(DID registry)

    
    const checkResult = await checkContextAsk(contextAsk);
    if(checkResult.msg != '') {
      res.send({
        errMsg: checkResult.msg
      });
      return;
    }else contextAsk = checkResult.value;
  
    const createdResult = await createContextResource(contextAsk);
    if(createdResult.msg != '') {
      res.send({
        errMsg: createdResult.msg
      });
      return;
    }    
    const context = createdResult.value;
    res.send(context)

    //@fixed service registry smart contract
    // storeContext();
    // res.send({
    //   msg: 'success assign context'
    // });
  });
};






/**
 * 
 * 
 * 
 * 
 * 
 * 
*/
//Area of MAIN FUNC 1
const validAttr = new Map();
validAttr.set('replicas','number');
validAttr.set('isMax','boolean');
validAttr.set('ports','array');
validAttr.set('isReplace','boolean');
validAttr.set('name','string');
async function checkContextAsk(contextAsk){
  //1. check grammar of contextAsk
  if(typeof contextAsk != 'object'){
    return {
      value: contextAsk,
      msg:'Invalid Valid of Context Ask'
    };
  }

  const documentAttr = Object.keys(contextAsk)
  for(let i=0; i<documentAttr.length; i++){
    const attr = documentAttr[i];
    const validType = validAttr.get(attr);
    const curAttrType = typeof contextAsk[attr];

    if(validType == 'array'){
      if(!Array.isArray(contextAsk[attr])){
        return {
          value: contextAsk,
          msg:`Invalid ${attr} of attribute`
        }
      }
      continue;
    }
    if(curAttrType != validType) {
      return {
        value: contextAsk,
        msg: `Invalid ${attr} of attribute`
      };
    }

  }

  //2. check nodes number 
  const nodesNumber = await k8sClient.getNodesNumber()
  if(nodesNumber < contextAsk['replicas']){
    if(contextAsk['isMax']){
      contextAsk['replicas'] = nodesNumber;
      return {value: contextAsk, msg:''}
    }else{
      return {
        value: contextAsk,
        msg: `The requested number exceeds the number of k8s nodes, Current Max Replicas: ${nodesNumber}`
      };
    }
  }
  return {value: contextAsk, msg: ''};
}




//Area of MAIN FUNC 2
/**
 * - namespace: yaml name
 * - service account: yaml name + '-account'
 * - service object: yaml name + '-endpoint1,2,3'
 */
async function createContextResource(contextAsk){

  const namespace = contextAsk.name;
  const replicas = contextAsk.replicas;
  const ports = contextAsk.ports;

  //1. make namespace
  const errCreateNamespace = await k8sClient.createNamespace(namespace);
  if(errCreateNamespace!=''){
    return {
      value:'',
      msg: '[ERROR CREATE NAMESPACE]: ' + errCreateNamespace
    } 
  }

  // 2. make account
  const errCreateAccount = await k8sClient.createAccount(namespace);
  if(errCreateAccount!='') {
    return {
      value: '',
      msg: '[ERROR CREATE ACCOUNT]: '+errCreateAccount
    }
  }

  // 3. assign account permission
  const errAssignPermission = await k8sClient.assignPermissionAccount(namespace,replicas);
  if(errAssignPermission!='') {
    return {
      value: '',
      msg: '[ERROR ASSIGN ACCOUNT PERMISSION]: '+errAssignPermission
    }
  }

  // 4. create external network
  const createdEndpointResult = await k8sClient.createEndpoints(namespace, replicas, ports);
  if(createdEndpointResult.msg!='') {
    return {
      value: '',
      msg : '[ERROR CREATED ENDPOINT]: '+errCreateEndpoint
    }
  }
  const endPoints = createdEndpointResult.value;

  // 5. read access token
  const readResult = await k8sClient.readAccessToken(namespace, namespace+'-account');
  if(readResult.msg != ''){
    return{
      value: '',
      msg: readResult.msg
    }
  }

  // const endPoints = createdEndpointResult.value;
  const accessToken = readResult.value.accessToken;

  const context ={
    'api-server': k8sCfg.fixedAttr.apiServer,
    'access-token': accessToken,
    'assign-resources': {
      'node-id': k8sCfg.fixedAttr.nodeLabel,
      'network-id': namespace,
      'service-protocol': 'http', //@fixed https
      'service-points': endPoints,
      'service-port': ports,
      'node-mount-path':{
        'service': '',
        'etcd': '',
      }
    },
    'kubernetese-ca-cert': k8sCfg.fixedAttr.k8sCA_cert,
    'available-container-registry': k8sCfg.fixedAttr.availableContainer
  }
  return {
    value: context,
    msg: ''
  }
}



//Area of MAIN FUNC 3
function storeContext(){
  console.log("[func]: storeContext");

}

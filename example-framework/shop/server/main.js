const fs = require('fs');
const config = {
  'service-registry': {
     id: 'shop',
     endpoint: 'ws://203.250.77.150:8546',
     account: '0x2ff21a68a27137fa13a20e72066e9a2c8fe339bd',
     password: '1234',
     abi_path: `${__dirname}/../util/registry/ServiceRegistry.json`
   },
  'webpack-config': '',
  'debug-mode': true
}

const SUM_PATH = __dirname+'/sum'
const app = require('replication-app')(config)

app.replicateReq('POST','/plus', (req,res)=>{
    let sum = Number(fs.readFileSync(SUM_PATH,'utf8'));
    ++sum;
    const log = `[shop]=> client: ${req.body.client}, index: ${req.storedIndex}, sum: ${sum} \n`;
    fs.writeFileSync(SUM_PATH,String(sum));
    res.send(log);
}).rollback((req)=>{
    let sum = Number(fs.readFileSync(SUM_PATH,'utf8'));
    --sum;
    fs.writeFileSync(SUM_PATH,String(sum));
    console.log("rollback completed");
})

app.req('GET','/read',(req,res)=>{
    let sum = Number(fs.readFileSync('./sum','utf8'));
	res.send('sum: '+sum);
})

let server = app.listen(8888,()=>{
  console.log('service replication has started on port 7777')
})


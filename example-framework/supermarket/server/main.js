const app = require('BR2K-service')
const port = 3000



// replicate request execution
app.replicate('POST', '/', (req, res)=>{
	/* change local state */
	res.send('success!');
}).rollback((req)=>{
	/* revert local state */
})


// normal request execution
app.received('GET', '/', (req, res)=>{
	
})


app.listen(port,()=>{
  console.log(`Example BR2K service listening at http://localhost:${port}`)
})


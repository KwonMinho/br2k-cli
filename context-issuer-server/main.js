const express = require("express");
const bodyParser = require("body-parser");
const app = express();
const { router } = require("./router/main");
const cors = require('cors');
const port = 9000;

app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());
app.use(cors());

router(app);

app.listen(port, () => {
    console.log(`Running app at port ${port}`);
});
const express = require('express')
const bodyParser = require('body-parser')
const app = express();
const crypto = require('crypto');
const config = require("./config.json");
const zenytips = require('./zenytips');

app.set('port', (process.env.PORT || 443));
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))

app.get(config.zenytips.expressWatchPath, (request, response) => {
	const crc_token = request.query.crc_token
	if (crc_token) {
		const hash = crypto.createHmac('sha256', config.zenytips.TWITTER_CONSUMER_SECRET).update(crc_token).digest('base64')
		//console.log(`receive crc check. token=${crc_token} responce=${hash}`);
		response.status(200);
		response.send({
			response_token: 'sha256=' + hash
		});
	} else {
		response.status(400);
		response.send('Error: crc_token missing from request.');
	}
})

app.post(config.zenytips.expressWatchPath, (request, response) => {
	zenytips.aaapi(request.body);
	response.send('200 OK');
});

var fs = require('fs');
var https = require('https');
var options = {
	key: fs.readFileSync (''),
	cert: fs.readFileSync(''),
	ca: [fs.readFileSync(''), fs.readFileSync('')]
};
var server = https.createServer(options,app);

server.listen(app.get('port'), function(){
	console.log('Node app is running on port', app.get('port'))
})


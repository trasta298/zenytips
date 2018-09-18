let tipbot = {};
let twitter = {};
let pending = {
	"w":[],"t":[]
};

require('date-utils');
const fs = require('fs');
const log4js = require('log4js');
const client = require('./client');
const client_mona = require('./client_mona');
const TwitterAPI = require('twit');
const config = require('./config.json');
log4js.configure('./log4js.config.json');
const logger = log4js.getLogger('bot');
const BigNumber = require('bignumber.js');
BigNumber.config({ DECIMAL_PLACES: 8 });

const MY_ID = "940524286531461120";//@zenytips

tipbot.aaapi = async (data) => {
	if(data.tweet_create_events && data.tweet_create_events[0].user.id_str != MY_ID){
		tipbot.on(data.tweet_create_events[0].extended_tweet && data.tweet_create_events[0].extended_tweet.full_text ? data.tweet_create_events[0].extended_tweet.full_text : data.tweet_create_events[0].text, data.tweet_create_events[0].user, data.tweet_create_events[0].id_str, data.tweet_create_events[0]);
	}else if(data.direct_message_events && data.direct_message_events[0].message_create.sender_id != MY_ID){
		const sender = data.direct_message_events[0].message_create.sender_id;
		tipbot.on(data.direct_message_events[0].message_create.message_data.text, data.users[sender], null, null);
	}
}

tipbot.on = async (text, user, tweetid, tweetobj) => {
	if (user == null) {return;}
	
	const userid = user.id_str || user.id;
	const name = user.screen_name;
	const account = "tipzeny-" + userid;
	const account_mona = "tipmona-" + userid;
	const cms = 0.01;
	let match = null;

	if((text.match(/@zenytips/) || tweetid == null) && text.search(/RT/) != 0){
		text = text.replace(/\n/, " ");
		//help
		if(text.match(/help|ヘルプ/i)){
			twitter.post(`使い方は以下のリンクを見てください！\nhttps://github.com/trasta298/zenytips/blob/master/README.md`, user, tweetid);
		}
		//rain
		else if(match = text.match(/(rain)( |　)+(\d+\.?\d*|\d*\.?\d+)/)){
			if(tweetid == null || tweetid == 0){
				return;
			}
			logger.info(`@${name} rain- ${match[3]}zny`);
			const amount = parseFloat(match[3]);
			if(amount <= 0){
				twitter.post("0イカの数は指定できませんっ！", user, tweetid);
				return;
			}
			const balance = await client.getBalance(account, 6);
			if(amount > balance){
				twitter.post(`残高が足りないみたいですっ\n残高:${balance}zny`, user, tweetid);
				return;
			}
			const tweet = `【お知らせ】\nリプライ先のツイートをRTした人に ${amount}znyのプレゼント！`;
			twitter.post(tweet, user, tweetid);
			tipbot.addRain(tweetid, account, amount);
		}
		//tip mona
		else if(match = text.match(/(tip|send|投げ銭|投銭)( |　)+@([A-z0-9_]+)( |　)+(\d+\.?\d*|\d*\.?\d+)( |　)+mona/)){
			logger.info(`@${name} tip- to @${match[3]} ${match[5]}mona`);
			const amount = parseFloat(match[5]);
			if(amount <= 0){
				twitter.post("0イカの数は指定できませんっ！", user, tweetid);
				return;
			}
			const to_name = match[3] == "zenytips" ? "tra_sta" : match[3];
			const to_user = await bot.get('users/show', {screen_name: to_name}).catch(() => null);
			if(to_user == null){
				twitter.post("ユーザーが見つかりませんでした...", user, tweetid);
				return;
			}
			const balance = await client_mona.getBalance(account_mona, 30);
			if(amount > balance){
				twitter.post(`残高が足りないよー！\n残高:${balance}mona`, user, tweetid);
				return;
			}
			const to_account = "tipmona-" + to_user.id_str;
			await client_mona.move(account_mona, to_account, amount);
			
			const tweet = tipbot.getanswer(userid,to_name,amount, tipbot.generateanswer_mona(to_name,name,amount))
			twitter.post(tweet, user, tweetid);
			logger.info("- complete.");
		}
		//tip
		else if(match = text.match(/(tip|send|投げ銭|投銭)( |　)+@([A-z0-9_]+)( |　)+(\d+\.?\d*|\d*\.?\d+)/)){
			logger.info(`@${name} tip- to @${match[3]} ${match[5]}zny`);
			const amount = parseFloat(match[5]);
			if(amount <= 0){
				twitter.post("0イカの数は指定できませんっ！", user, tweetid);
				return;
			}
			const to_name = match[3] == "zenytips" ? "tra_sta" : match[3];
			const to_user = await bot.get('users/show', {screen_name: to_name}).catch(() => null);
			if(to_user == null){
				twitter.post("ユーザーが見つかりませんでした...", user, tweetid);
				return;
			}
			const balance = await client.getBalance(account, 6);
			if(amount > balance){
				twitter.post(`残高が足りないみたいですっ\n残高:${balance}zny`, user, tweetid);
				return;
			}
			const to_account = "tipzeny-" + to_user.id_str;
			await client.move(account, to_account, amount);
			
			const tweet = tipbot.getanswer(userid,to_name,amount, tipbot.generateanswer(to_name,name,amount));
			twitter.post(tweet, user, tweetid);
			logger.info("- complete.");
		}
		//tip(ミス)
		else if((match = text.match(/(tip|send|投げ銭|投銭)( |　)+(\d+\.?\d*|\d*\.?\d+)/)) && (mention = text.match(/@([A-z0-9_]+)/))){
			logger.info(`@${name} tip- to @${mention[1]} ${match[3]}zny`);
			const amount = parseFloat(match[3]);
			if(amount <= 0){
				twitter.post("0イカの数は指定できませんっ！", user, tweetid);
				return;
			}
			const to_name = mention[1] == "zenytips" ? "tra_sta" : mention[1];
			const to_user = await bot.get('users/show', {screen_name: to_name}).catch(() => null);
			if(to_user == null){
				twitter.post("ユーザーが見つかりませんでした...", user, tweetid);
				return;
			}
			const balance = await client.getBalance(account, 6);
			if(amount > balance){
				twitter.post(`残高が足りないみたいですっ\n残高:${balance}zny`, user, tweetid);
				return;
			}
			const to_account = "tipzeny-" + to_user.id_str;
			tipbot.addWaitingTip(account, to_account, amount, to_name, tweetid);
			twitter.post(`@${mention[1]} さんに${amount}zny tipしますか？送金するなら'Tip'と入力してください`, user, null);
		}
		//Tip OK
		else if(text.match(/Tip/) && (tipdata = tipbot.getWaitingTip(account))){
			await client.move(account, tipdata.to_account, tipdata.amount);
			const tweet = tipbot.getanswer(userid,tipdata.to_name,tipdata.amount, tipbot.generateanswer(tipdata.to_name,name,tipdata.amount))
			twitter.post(tweet, user, tipdata.tweetid);
			logger.info("- complete.");
		}
		//balance mona
		else if(text.match(/balance mona|残高 mona/i)){
			const balance_all = await client_mona.getBalance(account_mona, 0);
			const balance = await client_mona.getBalance(account_mona, 30);
			let tweet = `現在の残高は ${balance}monaです！`;
			if(balance_all > balance){
				tweet += `承認中との合計(${balance_all}mona)`;
			}
			logger.info(`@${name}(${userid}) balance- ${balance}mona all(${balance_all}mona)`);
			twitter.post(tweet, user, tweetid);
		}
		//balance
		else if(text.match(/balance|残高/i)){
			const balance_all = await client.getBalance(account, 0);
			const balance = await client.getBalance(account, 6);
			let tweet = `現在の残高は ${balance}znyです！`;
			if(balance_all > balance){
				tweet += `承認中との合計(${balance_all}zny)`;
			}
			logger.info(`@${name}(${userid}) balance- ${balance}zny all(${balance_all}zny)`);
			twitter.post(tweet, user, tweetid);
		}
		//deposit mona
		else if(text.match(/deposit mona|入金 mona/i)){
			const address = await client_mona.getAccountAddress(account_mona);
			let tweet = address + "\nに送金お願いします！";
			logger.info(`@${name} deposit- ${address}`);
			twitter.post(tweet, user, tweetid);
		}
		//deposit
		else if(text.match(/deposit|入金/i)){
			const address = await client.getAccountAddress(account);
			let tweet = address + "\nに送金お願いします！";
			logger.info(`@${name} deposit- ${address}`);
			twitter.post(tweet, user, tweetid);
		}
		//withdraw OK
		else if(text.match(/OK|おけ/i) && (withdrawdata = tipbot.getWaitingWithdraw(account))){
			const txid = await client.sendFrom(account, withdrawdata.address, withdrawdata.amount).catch((err) => {
				twitter.post("送金エラーです...", user, tweetid);
				logger.error(`sendform error\n${err}`);
			});
			let fee = cms;
			const tx= await client.getTransaction(txid)
			if(tx){
				fee += tx.fee;
			}
			await client.move(account, 'taxpot', fee);
			twitter.post(`${withdrawdata.amount}znyを引き出しました！(手数料0.01zny)\nhttps://zeny.insight.monaco-ex.org/tx/${txid}`,user,tweetid);
			logger.info(`- complete. txid: ${txid}`);
		}
		//withdraw mona OK
		else if(text.match(/OK|おけ/i) && (withdrawdata = tipbot.getWaitingWithdraw(account_mona))){
			const txid = await client_mona.sendFrom(account_mona, withdrawdata.address, withdrawdata.amount).catch((err) => {
				twitter.post("送金エラーです...", user, tweetid);
				logger.error(`sendform error\n${err}`);
			});
			let fee = cms;
			const tx= await client_mona.getTransaction(txid)
			if(tx){
				fee += tx.fee;
			}
			await client_mona.move(account_mona, 'taxpot', fee);
			twitter.post(`${withdrawdata.amount}monaを引き出しました！(手数料0.01mona)\nhttps://mona.chainsight.info/tx/${txid}`,user,tweetid);
			logger.info(`- complete. txid: ${txid}`);
		}
		//withdraw mona
		else if(match = text.match(/(withdraw|出金)( |　)+([MP][a-zA-Z0-9]{20,50})( |　)+(\d+\.?\d*|\d*\.?\d+)/)){
			if(tweetid != null){
				return;
			}
			logger.info(`@${name} withdraw- ${match[5]}mona to ${match[3]}`);
			const address = match[3];
			const validate = await client_mona.validateAddress(address);
			if(!validate['isvalid']){
				twitter.post("アドレスが間違っているみたい…", user, tweetid);
				return;
			}
			const balance = await client_mona.getBalance(account_mona, 30);
			if(match[5] <= cms || match[5] > balance){
				twitter.post(`残高が足りないみたいですっ\n残高:${balance}mona`, user, tweetid);
				return;
			}
			const amount = new BigNumber(match[5],10).minus(cms);
			tipbot.addWaitingWithdraw(account_mona, address, amount);
			twitter.post(`${amount}mona(手数料0.01mona)送金するよ！間違いが無ければ'OK'と入力してね！`, user, null);
		}
		//withdrawall mona
		else if(match = text.match(/(withdrawall|全額出金)( |　)+([MP][a-zA-Z0-9]{20,50})/)){
			if(tweetid != null){
				return;
			}
			logger.info(`@${name} withdrawall- to ${match[3]}`);
			const address = match[3];
			const validate = await client_mona.validateAddress(address);
			if(!validate['isvalid']){
				twitter.post("アドレスが間違っているみたい…", user, tweetid);
				return;
			}
			const balance = await client_mona.getBalance(account_mona, 30);
			const amount = new BigNumber(balance).minus(cms);
			if(amount <= 0){
				twitter.post(`残高が足りないみたいですっ\n残高:${balance}mona`, user, tweetid);
				return;
			}
			tipbot.addWaitingWithdraw(account_mona, address, amount);
			twitter.post(`${amount}mona(手数料0.01mona)送金するよ！間違いが無ければ'OK'と入力してね！`, user, null);
		}
		//withdraw
		else if(match = text.match(/(withdraw|出金)( |　)+(Z[a-zA-Z0-9]{20,50})( |　)+(\d+\.?\d*|\d*\.?\d+)/)){
			if(tweetid != null){
				return;
			}
			logger.info(`@${name} withdraw- ${match[5]}zny to ${match[3]}`);
			const address = match[3];
			const validate = await client.validateAddress(address);
			if(!validate['isvalid']){
				twitter.post("アドレスが間違っているみたいです…", user, tweetid);
				return;
			}
			const balance = await client.getBalance(account, 6);
			if(match[5] <= cms || match[5] > balance){
				twitter.post(`残高が足りないみたいですっ\n残高:${balance}zny`, user, tweetid);
				return;
			}
			const amount = new BigNumber(match[5],10).minus(cms);
			tipbot.addWaitingWithdraw(account, address, amount);
			twitter.post(`${amount}zny(手数料${cms}zny)送金しますか？送金するなら'OK'と入力してください`, user, null);
		}
		//withdrawall
		else if(match = text.match(/(withdrawall|全額出金)( |　)+(Z[a-zA-Z0-9]{20,50})/)){
			if(tweetid != null){
				return;
			}
			logger.info(`@${name} withdrawall- to ${match[3]}`);
			const address = match[3];
			const validate = await client.validateAddress(address);
			if(!validate['isvalid']){
				twitter.post("アドレスが間違っているみたいです…", user, tweetid);
				return;
			}
			const balance = await client.getBalance(account, 6);
			const amount = new BigNumber(balance).minus(cms);
			if(amount <= 0){
				twitter.post(`残高が足りないみたいですっ\n残高:${balance}zny`, user, tweetid);
				return;
			}
			tipbot.addWaitingWithdraw(account, address, amount);
			twitter.post(`${amount}zny(手数料${cms}zny)送金しますか？送金するなら'OK'と入力してください`, user, null);
		}
		//thanks
		else if(match = text.match(/(thanks|感謝)( |　)+@([A-z0-9_]+)/)){
			const amount = 3.939;
			logger.info(`@${name} tip- to @${match[3]} ${amount}zny`);
			const to_name = match[3] == "zenytips" ? "tra_sta" : match[3];
			const to_user = await bot.get('users/show', {screen_name: to_name}).catch(() => null);
			if(to_user == null){
				twitter.post("ユーザーが見つかりませんでした...", user, tweetid);
				return;
			}
			const balance = await client.getBalance(account, 6);
			if(amount > balance){
				twitter.post(`残高が足りないみたいですっ\n残高:${balance}zny`, user, tweetid);
				return;
			}
			const to_account = "tipzeny-" + to_user.id_str;
			await client.move(account, to_account, amount);
			const tweet = tipbot.getanswer(userid,to_name,amount,`￰@${to_name}さんへ 感謝の${amount}znyだよ！`);
			twitter.post(tweet, user, tweetid);
			logger.info("- complete.");
		}
		//good
		else if(match = text.match(/(good)( |　)+@([A-z0-9_]+)/)){
			const amount = 1.14;
			logger.info(`@${name} tip- to @${match[3]} ${amount}zny`);
			const to_name = match[3] == "zenytips" ? "tra_sta" : match[3];
			const to_user = await bot.get('users/show', {screen_name: to_name}).catch(() => null);
			if(to_user == null){
				twitter.post("ユーザーが見つかりませんでした...", user, tweetid);
				return;
			}
			const balance = await client.getBalance(account, 6);
			if(amount > balance){
				twitter.post(`残高が足りないみたいですっ\n残高:${balance}zny`, user, tweetid);
				return;
			}
			const to_account = "tipzeny-" + to_user.id_str;
			await client.move(account, to_account, amount);
			const tweet =tipbot.getanswer(userid,to_name,amount,`￰@${to_name}さんへ ${amount}znyだよ！いいね！`)
			twitter.post(tweet, user, tweetid);
			logger.info("- complete.");
		}
		//kekkon
		else if(text.match(/結婚|ケッコン|けっこん|婚約/)){
			const score = await tipbot.getscore(userid);
			let tweets;
			if(score > 10000){
				tweets = ["私も同じことを考えていました！えへへ…私って幸せ者ですね…♪これから一緒に幸せな家庭を築いていきましょうね！","わわっ嬉しい…！こちらこそよろしくお願いします！これからもずっと一緒ですよ…♪","わわわっ…！もちろんです！これからもよろしくお願いしますね！将来がとても楽しみです…♪"];
			}else if(score > 8000){
				tweets = ["今度一緒にお食事しませんか…？それから決めさせてください…","もう少し2人っきりのお時間が欲しいです…まだ心の準備が…","私の考えがまとまるまであともう少しだけお時間をください…"];
			}else if(score > 4000){
				tweets = ["少し早い気がします💦 今のところはまだお友達のままが良いと思います…( ˊᵕˋ ;)","うーん、もう少し考える時間をください…💦","お互いのためにもう少し、お友達のままでいさせてください…！"];
			}else if(score > 2000){
				tweets = ["気持ちは嬉しいですけど…ごめんなさい！","今のところはお友達のままでお願いしますね( ˊᵕˋ ;)","もう少し仲良くなってからでお願いします💦"];
			}else if(score > 1000){
				tweets = ["良いですよ♪…って、冗談ですよ〜！","なんだか早い気がします〜！もう少しゆっくりしてからでお願いしますね💦","こ、困ります…！まだ待ってください💦"];
			}else if(score > 400){
				tweets = ["そんなに焦らなくても大丈夫ですよ〜！","もっと仲良くなってからでお願いしますね！","お友達のままでお願いしますね！"];
			}else{
				tweets = ["ふふっ 変な冗談を言うお方なんですね","も〜冗談はやめてくださいってばー！","えっと…反応に困る冗談はよしてください…"];
			}
		
			const tweet = tweets[Math.floor(Math.random() * tweets.length)];
			twitter.post(tweet, user, tweetid);
			logger.info(`@${name} score- ${score}`);
		}
	}
}

tipbot.deleteRain = async (id) =>{ //does not wait
	let data = await tipbot.getRain();
	if(data[id]){
		delete data[id];
	}
	fs.writeFile('./rain.json', JSON.stringify(data), (error) => {});
}

tipbot.addRain = async (id, account, amount) =>{ //does not wait
	let data = await tipbot.getRain();
	data[id] = {
		"account" : account,
		"amount" : amount,
		"list" : []
	};
	fs.writeFile('./rain.json', JSON.stringify(data), (error) => {});
}

tipbot.getRain = () =>new Promise((resolve,reject)=>{
	fs.readFile('./rain.json', 'utf8',(err,result)=>{
		if(err){
			logger.error("read error\n"+err)
			return reject()
		}
		resolve(JSON.parse(result))
	})
})

tipbot.addList = async (id, userid) =>{ //does not wait
	let data = await tipbot.getRain();
	if(!data[id]){
		return false;
	}
	for(let i in data[id]["list"]){
		if(data[id]["list"][i] == userid){
			return false;
		}
	}
	data[id]["list"].push(userid);
	fs.writeFile('./rain.json', JSON.stringify(data), (error) => {});
	let obj = {"account":data[id]["account"],"amount":data[id]["amount"]};
	return obj;
}

tipbot.addWaitingWithdraw = (account, address, amount) => {
	const withdrawdata = {
		"account" : account,
		"address" : address,
		"amount" : amount
	};
	for(let i in pending['w']){
		if(pending['w'][i].account == account){
			pending['w'][i] = withdrawdata;
			return;
		}
	}
	pending['w'].push(withdrawdata);
}

tipbot.getWaitingWithdraw = (account) => {
	for(let i in pending['w']){
		if(pending['w'][i].account == account){
			const data = pending['w'][i];
			pending['w'].splice(i,1);
			return data;
		}
	}
	return false;
}

tipbot.addWaitingTip = (account, to_account, amount, to_name, tweetid) => {
	const withdrawdata = {
		"account" : account,
		"to_account" : to_account,
		"amount" : amount,
		"to_name" : to_name,
		"tweetid" : tweetid
	};
	for(let i in pending['t']){
		if(pending['t'][i].account == account){
			pending['t'][i] = withdrawdata;
			return;
		}
	}
	pending['t'].push(withdrawdata);
}

tipbot.getWaitingTip = (account) => {
	for(let i in pending['t']){
		if(pending['t'][i].account == account){
			const data = pending['t'][i];
			pending['t'].splice(i,1);
			return data;
		}
	}
	return false;
}

tipbot.addscore = async (id, p) =>{ //does not wait
	let data = await tipbot.getallscore();
	data[id] = data[id] ? data[id]+p : p;
	fs.writeFile('./score.json', JSON.stringify(data), (error) => {});
}

tipbot.getscore = (id) =>new Promise((resolve,reject)=>{
	fs.readFile('./score.json', 'utf8',(err,result)=>{
		if(err){
			logger.error("read error\n"+err)
			return reject()
		}
		resolve(JSON.parse(result)[id] || 0)
	})
})

tipbot.getallscore = (id) =>new Promise((resolve,reject)=>{
	fs.readFile('./score.json', 'utf8',(err,result)=>{
		if(err){
			logger.error("read error\n"+err)
			return reject()
		}
		resolve(JSON.parse(result))
	})
})

tipbot.getanswer= (userid,screen_name,amount,answerText)=>{
	if(screen_name == "tra_sta") {
		tipbot.addscore(userid, amount*10);
		if(answerText.match(/mona/)){
			return `${amount}mona受け取りましたっ！りん姫への寄付ありがとうございます！`
		}
		return `${amount}zny受け取りましたっ！りん姫への寄付ありがとうございます！`
	}else{
		tipbot.addscore(userid, amount);
		return answerText
	}
}

tipbot.generateanswer=(to,from,amount)=>{
	const tweets = [
		`‌@${to}さんへ @${from}さんから ${amount}znyのお届け物です！`,
		`‌@${to}さんへ @${from}さんから ${amount}znyの投げ銭です！`,
		`‌@${to}さんへ @${from}さんから ${amount}znyをtip!`,
		`‌@${to}さんへ @${from}さんからZnyが来てます！ つ${amount}zny`,
		`‌@${to}さんへ @${from}さんから投げ銭が来てます！ つ${amount}zny`
	];
	return tweets[Math.floor(Math.random() * tweets.length)]
}

tipbot.generateanswer_mona=(to,from,amount)=>{
	const tweets = [
		`‌@${to}さんへ @${from}さんから ${amount}monaのお届け物です！`,
		`‌@${to}さんへ @${from}さんから ${amount}monaのお届け物ですよ！`,
		`‌@${to}さんへ @${from}さんから ${amount}monaのお届け物ですよ〜！`,
		`‌@${to}さんへ @${from}さんから ${amount}monaのお届け物ですよー！`,
		`‌@${to}さんへ @${from}さんからmonaが来てます！ つ${amount}mona`,
		`‌@${to}さんへ @${from}さんからmonaが来てますよ！ つ${amount}mona`,
		`‌@${to}さんへ @${from}さんからmonaが来てますよっ！ つ${amount}mona`,
		`‌@${to}さんへ @${from}さんからmonaが来てますよ～！ つ${amount}mona`,
		`‌@${to}さんへ @${from}さんからmonaが来てますよー！ つ${amount}mona`,
	];
	return tweets[Math.floor(Math.random() * tweets.length)]
}

const bot = new TwitterAPI({
	consumer_key: config.zenytips.TWITTER_CONSUMER_KEY,
	consumer_secret: config.zenytips.TWITTER_CONSUMER_SECRET,
	access_token: config.zenytips.TWITTER_ACCESS_TOKEN,
	access_token_secret: config.zenytips.TWITTER_ACCESS_TOKEN_SECRET
});

twitter.post = (text, user, id) => {
	if(id === null){
		twitter.sendDM(text, user.id);
	}else if(id === 0){
		twitter.update(text, null);
	}else{
		twitter.update(`@${user.screen_name} ${text}`, id);
	}
}

twitter.update = (text, in_reply) => {
	bot.post('statuses/update', {status: text, in_reply_to_status_id: in_reply},  function(error, tweet, response) {
		if(error){
			logger.error(error);
		}

	});
}

twitter.sendDM = (text, sender) => {
	bot.post('direct_messages/events/new', {"event": {"type": "message_create", "message_create": {"target": {"recipient_id": sender}, "message_data": {"text": text}}}}, function(error, data, resp) {
		if(error){
			logger.error(error);
		}
	});
}

module.exports = tipbot;

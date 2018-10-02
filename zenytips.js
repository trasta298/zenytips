let tipbot = {};
let twitter = {};
let pending = {
	"w":[],"t":[]
};
let mojis = {};

require('date-utils');
const fs = require('fs');
const log4js = require('log4js');
const client = require('./client');
const client_mona = require('./client_mona');
const TwitterAPI = require('twit');
const config = require('./config.json');
log4js.configure('./log4js.config.json');
const logger = log4js.getLogger('zeny');
const BigNumber = require('bignumber.js');
BigNumber.config({ DECIMAL_PLACES: 8 });


const MY_ID = "940524286531461120"; //@zenytips

tipbot.aaapi = async (data) => {
	if(data.tweet_create_events && data.tweet_create_events[0].user.id_str != MY_ID){
		tipbot.on(data.tweet_create_events[0].extended_tweet && data.tweet_create_events[0].extended_tweet.full_text ? data.tweet_create_events[0].extended_tweet.full_text : data.tweet_create_events[0].text, data.tweet_create_events[0].user, data.tweet_create_events[0].id_str);
	}else if(data.direct_message_events && data.direct_message_events[0].message_create.sender_id != MY_ID){
		const sender = data.direct_message_events[0].message_create.sender_id;
		tipbot.on(data.direct_message_events[0].message_create.message_data.text, data.users[sender], null, null);
	}
}

tipbot.on = async (text, user ,tweetid) => {
	if(user == null){
		return;
	}

	const userid = user.id_str || user.id; //ツイートしたユーザーのID
	const name = user.screen_name; //ツイートしたユーザーのスクリーンネーム
	const account = "tipzeny-" + userid; //ツイートしたユーザーのzenytipsアカウント
	const account_mona = "tipmona-" + userid; //ツイートしたユーザーのmonatipbotアカウント
	let fee = new BigNumber(0.01); //手数料
	const confirm = 6; //承認数
	let match = null; //テキストマッチ

	if((!text.match(/@zenytips/) && tweetid != null) || text.search(/RT/) == 0){
		return;
	}
	text = text.replace(/\n/, " ");

	/**
	 * help ヘルプ
	 */
	if(text.match(/help|ヘルプ/i)){
		/*twitter.post(`このbotの使い方を見たいときは'How to use'、設定をしたいときは'Settings'と入力してください！`, user, null, 
			[['How to use','使い方'],['Settings','設定']]
		);*/
		twitter.post(`使い方は以下のリンクを見てください！\nhttps://github.com/trasta298/zenytips/blob/master/README.md`, user, tweetid);
	}
	/**
	 * how to use 使い方のリンクを送信
	 */
	if(text.search(/How to use|使い方/i) == 0){
		twitter.post(`使い方は以下のリンクを見てください！\nhttps://github.com/trasta298/zenytips/blob/master/README.md`, user, tweetid);
	}
	/**
	 * add mojis
	 */
	if(match = text.match(/(addmojis)( |　)+(.*)( |　)+(\d+\.?\d*|\d*\.?\d+)/)){
		if(!isNaN(match[3])){
			twitter.post("無効な文字列です！", user, tweetid);
			return;
		}
		if(mojis[match[3]]){
			twitter.post(`${match[3]} (${mojis[match[3]]["amount"]}zny)はすでに追加されています！`, user, tweetid);
			return;
		}
		const amount = new BigNumber(match[5], 10);
		tipbot.addmojis(match[3], amount, "");
		twitter.post(`${match[3]} (${amount}zny)をtipオプションに追加しました！`, user, tweetid);
	}
	/**
	 * message
	 */
	else if(match = text.match(/message( |　)(.*)/)){
		twitter.post(`開発(@tra_sta)からのメッセージです！\n「${match[2]}」`, user, 0);
		logger.info(`@${name} messege- ${match[2]}`);
	}
	/**
	 * balance 残高
	 */
	else if(text.match(/balance|残高/i)){
		const balance_all = await client.getBalance(account, 0);
		const balance = await client.getBalance(account, confirm);
		let tweet = `現在の残高は ${balance}znyです！`;
		if(balance_all > balance){
			tweet += `承認中との合計(${balance_all}zny)`;
		}
		logger.info(`@${name}(${userid}) balance- ${balance}zny all(${balance_all}zny)`);
		twitter.post(tweet, user, tweetid);
	}
	/**
	 * deposit 入金
	 */
	else if(text.match(/deposit|入金/i)){
		const address = await client.getAccountAddress(account);
		let tweet = `${address}\nに送金お願いします！`;
		logger.info(`@${name} deposit- ${address}`);
		twitter.post(tweet, user, tweetid);
	}
	/**
	 * tip
	 */
	else if(match = text.match(/(tip|send|投げ銭|投銭)( |　)+@([A-z0-9_]+)( |　)+(\d+\.?\d*|\d*\.?\d+)/)){
		const amount = new BigNumber(match[5], 10);
		const to_name = match[3] == "zenytips" ? "tra_sta" : match[3];
		const to_userdata = await bot.get('users/show', {screen_name: to_name}).catch(() => null);
		if(amount <= 0){
			twitter.post("0イカの数は指定できませんっ！", user, tweetid);
			return;
		}
		if(!to_userdata){
			twitter.post("ユーザーが見つかりませんでした...", user, tweetid);
			return;
		}
		const to_user = to_userdata.data;
		const to_account = "tipzeny-" + to_user.id_str;
		const balance = await client.getBalance(account, confirm);
		if(amount > balance){
			twitter.post(`残高が足りないみたいですっ\n残高:${balance}zny`, user, tweetid);
			return;
		}
		let move = await client.move(account, to_account, amount);
		if(!move){
			twitter.post('送金に失敗してしまったみたいです...', user, tweetid);
			return;
		}
		const tweet = tipbot.getanswer(userid,to_name,amount, tipbot.generateanswer(to_name,name,amount));
		twitter.post(tweet, user, tweetid);
		logger.info(`@${name} tip- to @${match[3]} ${match[5]}zny`);
	}
	/**
	 * tip mojis
	 */
	else if(match = text.match(/(tip|send|投げ銭|投銭)( |　)+@([A-z0-9_]+)( |　)+(.*)/)){
		const match2 = match[5].split(/ |　/);
		if(Object.keys(mojis).length === 0){
			mojis = await tipbot.getallmojis();
		}
		if(!mojis[match2[0]]){
			return;
		}
		const amount = new BigNumber(mojis[match2[0]]["amount"]);
		const to_name = match[3] == "zenytips" ? "tra_sta" : match[3];
		const to_userdata = await bot.get('users/show', {screen_name: to_name}).catch(() => null);
		if(amount <= 0){
			twitter.post("0イカの数は指定できませんっ！", user, tweetid);
			return;
		}
		if(!to_userdata){
			twitter.post("ユーザーが見つかりませんでした...", user, tweetid);
			return;
		}
		const to_user = to_userdata.data;
		const to_account = "tipzeny-" + to_user.id_str;
		const balance = await client.getBalance(account, confirm);
		if(amount > balance){
			twitter.post(`残高が足りないみたいですっ\n残高:${balance}zny`, user, tweetid);
			return;
		}
		let move = await client.move(account, to_account, amount);
		if(!move){
			twitter.post('送金に失敗してしまったみたいです...', user, tweetid);
			return;
		}
		const tweet = tipbot.getanswer(userid,to_name,amount, tipbot.generateanswer(to_name,name,amount));
		twitter.post(tweet, user, tweetid);
		logger.info(`@${name} tip- to @${match[3]} ${amount}zny`);
	}
	/**
	 * tip(miss) tipにメンションをつけ忘れたとき
	 */
	else if((match = text.match(/(tip|send|投げ銭|投銭)( |　)+(\d+\.?\d*|\d*\.?\d+)/)) && (mention = text.match(/@([A-z0-9_]+)/))){
		const amount = new BigNumber(match[3], 10);
		const to_name = mention[1] == "zenytips" ? "tra_sta" : mention[1];
		const to_userdata = await bot.get('users/show', {screen_name: to_name}).catch(() => null);
		if(amount <= 0){
			twitter.post("0イカの数は指定できませんっ！", user, tweetid);
			return;
		}
		if(!to_userdata){
			twitter.post("ユーザーが見つかりませんでした...", user, tweetid);
			return;
		}
		const to_user = to_userdata.data;
		const balance = await client.getBalance(account, confirm);
		const to_account = "tipzeny-" + to_user.id_str;
		if(amount > balance){
			twitter.post(`残高が足りないみたいですっ\n残高:${balance}zny`, user, tweetid);
			return;
		}
		tipbot.addWaitingTip(account, to_account, amount, to_name, tweetid);
		twitter.post(`@${mention[1]} さんに${amount}zny tipしますか？送金するなら'Tip'と入力してください`, user, null, 
			[['Tip','送金'],['Cancel','キャンセル']]
		);
	}
	/**
	 * Tip OK tipに対してOKと返されたとき
	 */
	else if(text.match(/Tip/) && (tipdata = tipbot.getWaitingTip(account))){
		const res = await client.move(account, tipdata.to_account, tipdata.amount);
		if(res){
			const tweet = tipbot.getanswer(userid,tipdata.to_name,tipdata.amount, tipbot.generateanswer(tipdata.to_name,name,tipdata.amount));
			twitter.post(tweet, user, tipdata.tweetid);
			logger.info(`@${name} tip- to @${tipdata.to_name} ${tipdata.amount}zny`);
		}else{
			twitter.post("送金に失敗したみたいです...", user, tipdata.tweetid);
		}
	}
	/**
	 * withdraw OK
	 */
	else if(text.match(/OK|おけ/i) && (withdrawdata = tipbot.getWaitingWithdraw(account))){
		const txid = await client.sendFrom(account, withdrawdata.address, withdrawdata.amount).catch((err) => {
			twitter.post("送金エラーです...", user, tweetid);
			logger.error(`sendform error\n${err}`);
		});
		const tx= await client.getTransaction(txid);
		if(tx){
			fee = fee.plus(tx.fee);
		}
		let move = false;
		if(fee > 0){
			move = await client.move(account, 'taxpot', fee);
		}else{
			move = await client.move('taxpot', account, -fee);
		}
		if(move){
			twitter.post(`${withdrawdata.amount}znyを引き出しました！(手数料0.01zny)\nhttps://zeny.insight.monaco-ex.org/tx/${txid}`,user,tweetid);
			logger.info(`@${name} withdraw- ${withdrawdata.address} ${withdrawdata.amount}zny complete. txid: ${txid}`);
		}else{
			twitter.post("送金に失敗したみたいです...", user, tipdata.tweetid);
		}
	}
	/**
	 * withdraw
	 */
	else if(match = text.match(/(withdraw|出金)( |　)+(Z[a-zA-Z0-9]{20,50})( |　)+(\d+\.?\d*|\d*\.?\d+)/)){
		if(tweetid != null){
			twitter.post("withdrawはDM専用コマンドです！DMでメッセージお願いします！", user, tweetid);
			return;
		}
		const address = match[3];
		const validate = await client.validateAddress(address);
		if(!validate['isvalid']){
			twitter.post("アドレスが間違っているみたいです…", user, tweetid);
			return;
		}
		const balance = await client.getBalance(account, confirm);
		if(match[5] <= fee || match[5] > balance){
			twitter.post(`残高が足りないみたいですっ\n残高:${balance}zny`, user, tweetid);
			return;
		}
		const amount = new BigNumber(match[5],10).minus(fee);
		tipbot.addWaitingWithdraw(account, address, amount);
		twitter.post(`${amount}zny(手数料${fee}zny)送金しますか？送金するなら'OK'と入力してください`, user, null, 
			[['OK','送金'],['Cancel','キャンセル']]
		);
	}
	/**
	 * withdrawall
	 */
	else if(match = text.match(/(withdrawall|全額出金)( |　)+(Z[a-zA-Z0-9]{20,50})/)){
		if(tweetid != null){
			twitter.post("withdrawはDM専用コマンドです！DMでメッセージお願いします！", user, tweetid);
			return;
		}
		const address = match[3];
		const validate = await client.validateAddress(address);
		if(!validate['isvalid']){
			twitter.post("アドレスが間違っているみたいです…", user, tweetid);
			return;
		}
		const balance = await client.getBalance(account, confirm);
		const amount = new BigNumber(balance).minus(fee);
		if(amount <= 0){
			twitter.post(`残高が足りないみたいですっ\n残高:${balance}zny`, user, tweetid);
			return;
		}
		tipbot.addWaitingWithdraw(account, address, amount);
		twitter.post(`${amount}zny(手数料${fee}zny)送金しますか？送金するなら'OK'と入力してください`, user, null, 
			[['OK','送金'],['Cancel','キャンセル']]
		);
	}
	/**
	 * thanks その他
	 */
	else if(match = text.match(/(thanks|感謝|いえーい)( |　)+@([A-z0-9_]+)/)){
		const amount = new BigNumber(3.939);
		const to_name = match[3] == "zenytips" ? "tra_sta" : match[3];
		const to_userdata = await bot.get('users/show', {screen_name: to_name}).catch(() => null);
		if(amount <= 0){
			twitter.post("0イカの数は指定できませんっ！", user, tweetid);
			return;
		}
		if(!to_userdata){
			twitter.post("ユーザーが見つかりませんでした...", user, tweetid);
			return;
		}
		const to_user = to_userdata.data;
		const to_account = "tipzeny-" + to_user.id_str;
		const balance = await client.getBalance(account, confirm);
		if(amount > balance){
			twitter.post(`残高が足りないみたいですっ\n残高:${balance}zny`, user, tweetid);
			return;
		}
		let move = await client.move(account, to_account, amount);
		if(!move){
			twitter.post('送金に失敗してしまったみたいです...', user, tweetid);
			return;
		}
		const tweet = tipbot.getanswer(userid, to_name, amount,`‌@${to_name}さんへ 感謝の${amount}znyだよ！`);
		twitter.post(tweet, user, tweetid);
		logger.info(`@${name} tip- to @${match[3]} ${amount}zny`);
	}
	/**
	 * kekkon
	 */
	else if(text.match(/結婚|ケッコン|けっこん|婚約/)){
		const score = await tipbot.getscore(userid, "score");
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

tipbot.changesetting = async (id, set, val) =>{ //does not wait
	let data = await tipbot.getallscore();
	data[id][set] = val;
	fs.writeFile('./score.json', JSON.stringify(data), (error) => {});
}

tipbot.addscore = async (id, p) =>{ //does not wait
	let data = await tipbot.getallscore();
	data[id].score = data[id].score ? data[id].score+p : p;
	fs.writeFile('./score.json', JSON.stringify(data), (error) => {});
}

tipbot.getscore = (id, val) =>new Promise((resolve,reject)=>{
	fs.readFile('./score.json', 'utf8',(err,result)=>{
		if(err){
			logger.error("read error\n"+err)
			return reject()
		}
		resolve(id in JSON.parse(result) && val in JSON.parse(result)[id] ? JSON.parse(result)[id][val] : 0);
	})
})

tipbot.getallscore = () =>new Promise((resolve,reject)=>{
	fs.readFile('./score.json', 'utf8',(err,result)=>{
		if(err){
			logger.error("read error\n"+err)
			return reject()
		}
		resolve(JSON.parse(result))
	})
})

tipbot.addmojis = async (text, amount, message) =>{
	mojis = await tipbot.getallmojis();
	mojis[text] = {
		"message" : message,
		"amount" : amount
	};
	fs.writeFile('./mojis.json', JSON.stringify(mojis), (error) => {});
}

tipbot.getallmojis = () =>new Promise((resolve,reject)=>{
	fs.readFile('./mojis.json', 'utf8',(err,result)=>{
		if(err){
			logger.error("read error\n"+err)
			return reject()
		}
		resolve(JSON.parse(result));
	})
})

tipbot.getanswer= (userid,screen_name,amount,answerText)=>{
	if(screen_name == "tra_sta") {
		tipbot.addscore(userid, amount*10);
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

const bot = new TwitterAPI({
	consumer_key: config.zenytips.TWITTER_CONSUMER_KEY,
	consumer_secret: config.zenytips.TWITTER_CONSUMER_SECRET,
	access_token: config.zenytips.TWITTER_ACCESS_TOKEN,
	access_token_secret: config.zenytips.TWITTER_ACCESS_TOKEN_SECRET
});

twitter.post = (text, user, id, quick = null) => {
	if(id === null){
		twitter.sendDM(text, user.id, quick);
		logger.info(`DM @${user.screen_name} ${text}`);
	}else if(id === 0){
		twitter.update(text, null);
		logger.info(`@zenytips ${text}`);
	}else{
		twitter.update(`@${user.screen_name} ${text}`, id);
		logger.info(`@${user.screen_name} ${text}`);
	}
}

twitter.update = (text, in_reply) => {
	bot.post('statuses/update', {status: text, in_reply_to_status_id: in_reply},  function(error, tweet, response) {
		if(error){
			logger.error(error);
		}
	});
}

twitter.sendDM = (text, sender, quick) => {
	const data = {"event": {"type": "message_create", "message_create": {
		"target": {
			"recipient_id": sender
		}, 
		"message_data": {
			"text": text
		}
	}}};
	if(quick){
		data["event"]["message_create"]["message_data"]["quick_reply"] = {
			"type": "options",
			"options": []
		};
		for(let i in quick){
			data["event"]["message_create"]["message_data"]["quick_reply"]["options"].push({
				"label": quick[i][0],
				"description": quick[i][1],
				"metadata": `external_id_${i}`
			});
		}
	}
	bot.post('direct_messages/events/new', data, function(error, data, resp) {
		if(error){
			logger.error(error);
		}
	});
}

module.exports = tipbot;
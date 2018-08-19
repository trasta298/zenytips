let tipbot = {};
let twitter = {};

require('date-utils');
const fs = require('fs');
const log4js = require('log4js');
const client = require('./client');
const TwitterAPI = require('twitter');
const config = require('./config.json');
log4js.configure('./log4js.config.json');
const logger = log4js.getLogger('bot');

const MY_ID = "940524286531461120";//@zenytips

tipbot.aaapi = async (data) => {
	if(data.tweet_create_events && data.tweet_create_events[0].user.id_str != MY_ID){
		tipbot.on(data.tweet_create_events[0].text, data.tweet_create_events[0].user, data.tweet_create_events[0].id_str)
	}else if(data.direct_message_events && data.direct_message_events[0].message_create.sender_id != MY_ID){
		const sender = data.direct_message_events[0].message_create.sender_id;
		tipbot.on(data.direct_message_events[0].message_create.message_data.text, data.users[sender], null);
	}
}

tipbot.on = async (text, user, tweetid) => {
	if (user == null) {return;}
	
	const userid = user.id_str || user.id;
	const name = user.screen_name;
	const account = "tipzeny-" + userid;
	let match = null;

	if((text.match(/@zenytips/) || tweetid == null) && text.search(/RT/) != 0){
		text = text.replace(/\n/, " ");
		//いでよとらすた
		if(text.match(/いでよとらすた/)){
			const dt = new Date();
			const jp = new Date(dt.getTime() + 9 * 60 * 60 * 1000);
			const formatted = jp.toFormat("YYYY/MM/DD HH24:MI:SS");
			twitter.post(`来たぞ (${formatted})`, user, tweetid);
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
		//deposit
		else if(text.match(/deposit|入金/i)){
			const address = await client.getAccountAddress(account);
			let tweet = address + "\nに送金お願いします！";
			logger.info(`@${name} deposit- ${address}`);
			twitter.post(tweet, user, tweetid);
		}
		//withdraw
		else if(match = text.match(/(withdraw|出金)( |　)+(Z[a-zA-Z0-9]{20,50})( |　)+(\d+\.?\d*|\d*\.?\d+)/)){
			logger.info(`@${name} withdraw- ${match[5]}zny to ${match[3]}`);
			const address = match[3];
			const validate = await client.validateAddress(address);
			const cms = 0.01;
			if(!validate['isvalid']){
				twitter.post("アドレスが間違っているみたいです…", user, tweetid);
				return;
			}
			const balance = await client.getBalance(account, 6);
			if(match[5] <= cms || match[5] > balance){
				twitter.post(`残高が足りないみたいですっ\n残高:${balance}zny`, user, tweetid);
				return;
			}
			const amount = match[5]-cms;
			const txid = await client.sendFrom(account, address, amount).catch((err) => {
				logger.error(`sendform error\n${err}`);
				twitter.post("送金エラーです...", user, tweetid);
			});
			let fee = cms;
      const tx= await client.getTransaction(txid)
			if(tx){
				fee += tx.fee;
			}
			await client.move(account, 'taxpot', fee);
			twitter.post(`${amount}znyを引き出しました！(手数料0.01zny)\nhttps://zeny.insight.monaco-ex.org/tx/${txid}`,user,tweetid);
			logger.info(`- complete. txid: ${txid}`);
		}
		//withdrawall
		else if(match = text.match(/(withdrawall|全額出金)( |　)+(Z[a-zA-Z0-9]{20,50})/)){
			logger.info(`@${name} withdrawall- to ${match[3]}`);
			const address = match[3];
			const validate = await client.validateAddress(address);
			const cms = 0.01;
			if(!validate['isvalid']){
				twitter.post("アドレスが間違っているみたいです…", user, tweetid);
				return;
			}
			const balance = await client.getBalance(account, 6);
			const amount = balance-cms;
			if(amount <= 0){
				twitter.post(`残高が足りないみたいですっ\n残高:${balance}zny`, user, tweetid);
				return;
			}
			const txid = await client.sendFrom(account, address, amount).catch((err) => {
				logger.error(`sendform error\n${err}`);
				twitter.post("送金エラーです...", user, tweetid);
			});
			let fee = cms;
			const tx= await client.getTransaction(txid)
			if(tx){
				fee += tx.fee;
			}
			await client.move(account, 'taxpot', fee);
			twitter.post(`${amount}zny(全額)を引き出しました！(手数料0.01zny)\nhttps://zeny.insight.monaco-ex.org/tx/${txid}`,user,tweetid);
			logger.info(`- complete. txid: ${txid}`);
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
			
			const tweet = tipbot.getanswer(userid,to_user.screen_name,amount, tipbot.generateanswer(to_name,name,amount))
			twitter.post(tweet, user, tweetid);
			logger.info("- complete.");
			tipbot.addscore(userid, (to_name == "tra_sta" ? amount*10 : amount));
		}
		//thanks
		else if(match = text.match(/(thanks|感謝)( |　)+@([A-z0-9_]+)/)){
			const amount = 3.939;
			logger.info(`@${name} tip- to @${match[3]} ${amount}zny`);
			const to_name = match[3];
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
			const tweet = tipbot.getanswer(userid,to_user.screen_name,amount,`￰@${to_user.screen_name}さんへ 感謝の${amount}znyだよ！`);
			twitter.post(tweet, user, tweetid);
			logger.info("- complete.");
			tipbot.addscore(userid, (to_name == "tra_sta" ? amount*10 : amount));
		}
		//good
		else if(match = text.match(/(good)( |　)+@([A-z0-9_]+)/)){
			const amount = 1.14;
			logger.info(`@${name} tip- to @${match[3]} ${amount}zny`);
			const to_name = match[3];
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
			const tweet =tipbot.getanswer(userid,to_user.screen_name,amount,`￰@${to_user.screen_name}さんへ ${amount}znyだよ！いいね！`)
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
  access_token_key: config.zenytips.TWITTER_ACCESS_TOKEN,
  access_token_secret: config.zenytips.TWITTER_ACCESS_TOKEN_SECRET
});

twitter.post = (text, user, id) => {
	if(id === null){
		twitter.sendDM(text, user.screen_name);
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
	bot.post('direct_messages/new', {screen_name: sender, text: text }, function(error, data, resp) {
		if(error){
			logger.error(error);
		}
	});
}

module.exports = tipbot;

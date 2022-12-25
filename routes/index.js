var express = require('express');
var router = express.Router();
var paypal = require('paypal-rest-sdk');
const crypto = require('crypto');
let level = require('level')
var db = level('./data');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
var geoip = require('geoip-lite');
const { getgid } = require('process');
var for_gid_random_str = "bS9DUFMwBwYFZ4EMAQEwgYgGCCsGAQUFBwEBBHwwejAkBggrBgEFBQcwAYYYaHR0cDovL29jc3AuZGlnaWNlcnQuY29tMFIGCCsGAQUFBzAChkZodHRwOi8vY2FjZXJ0cy5kaWdpY2VydC5jb20vRGlnaUNlcnRTSEEyRXh0ZW5kZWRWYWxpZGF0aW9uU2VydmVyQ0EuY3J0MAwGA1UdEwEB / wQCMAAwggF / BgorBgEEAdZ5AgQCBIIBbwSCAWsB";
const sha256 = require('sha256');
var braintree = require('braintree');
var gateway = new braintree.BraintreeGateway({
    environment: braintree.Environment.Sandbox,
    merchantId: 'r8rzzbz92gqwnhsf',
    publicKey: 'wmwrghpfn945qy87',
    privateKey: 'd9865e2bff7f6ef2156248351b5f3932'
});

var config = require("./config")
var server_info = config.server_ip;
console.log("TTTTTTTTTTTTTTTTTTTTTTTTTTTTT: " + server_info)
var tocken_map = new Map();
var tocken_price_map = new Map();
var payItemMap = new Map();

class PayItem {
    constructor(order_id, appid, sign, type, price, account_id) {
        this.order_id = order_id;
        this.appid = appid;
        this.sign = sign;
        this.type = type;
        this.timestamp = Date.now();
        this.price = price;
        this.real_price = price;
        this.account_id = account_id;
        this.status = 0;
        this.retry_times = 0;
        this.gid = "";
    }

    getPrice() {
        return this.price;
    }

    accountId() {
        return this.account_id
    }

    getGid() {
        return this.gid;
    }

    initTimestamp() {
        return this.timestamp;
    }

    setInitTimestamp(timestamp) {
        this.timestamp = timestamp;
    }

    getType() {
        return this.type;
    }

    appId() {
        return this.appid;
    }

    getSign() {
        return this.sign;
    }

    orderId() {
        return this.order_id;
    }

    setPayGid(gid) {
        this.gid = gid;
    }

    getRealPrice() {
        return this.real_price;
    }

    setRealPrice(real_price) {
        console.log("set real price called.");
        this.real_price = real_price;
    }

    getStatus() {
        return this.status;
    }

    setStatus(status) {
        this.status = status;
    }

    addRetryTimes() {
        this.retry_times += 1;
    }

    retryTimes() {
        return this.retry_times;
    }
}

let Dictionary = (function () {
    const items = {};
    class Dictionary {
        constructor() {
        }
        set(key, value) {//向字典中添加新的元素
            items[key] = value;
        }
        delete(key) {//删除字典中某个指定元素
            if (this.has(key)) {
                delete items[key];
                return true;
            }
            return false;
        }
        has(key) {//如果某个键值存在于这个字典中，则返回true，否则返回false
            return items.hasOwnProperty(key);
        }
        get(key) {//通过键值查找特定的数值并返回。
            return this.has(key) ? items[key] : undefined;
        };
        clear() {//将这个字典中的所有元素全部删除。
            items = {};
        }
        size() {//返回字典所包含元素的数量。
            return Object.keys(items).length;
        }
        keys() {//将字典所包含的所有键名以数组形式返回。
            return Object.keys(items);
        }
        values() {//将字典所包含的所有数值以数组形式返回。
            var values = [];
            for (var k in items) {
                if (this.has(k)) {
                    values.push(items[k]);
                }
            }
            return values;
        }
        each(fn) {//遍历每个元素并且执行方法
            for (var k in items) {
                if (this.has(k)) {
                    fn(k, items[k]);
                }
            }
        }
        getItems() {//返回字典
            return items;
        }
    }
    return Dictionary;
})();

var global_index_arr = new Dictionary();
var global_gid_min_index = -1;
var global_gid_max_index = -1;
var global_added_gid = new Dictionary();
var global_init_loaded_gid_count = 0;
var global_paypal_callback_dic = new Dictionary();
var global_paypal_nonce_dic = new Dictionary();
var global_gen_key_dic = new Dictionary();

db.get("gid_min_index", function (err, value) {
    if (!err) {
        global_gid_min_index = parseInt(value);
    } else {
        global_gid_min_index = 0;
    }

    db.get("gid_max_index", function (err, max_val) {
        if (!err) {
            var max_gid_index = parseInt(max_val);
            for (var i = 0; i < max_gid_index; ++i) {
                var queue_key = "gid_index" + i;
                db.get(queue_key, function (err, gid_val) {
                    if (!err) {
                        global_added_gid.set(gid_val, gid_val);
                        ++global_init_loaded_gid_count;
                        if (global_init_loaded_gid_count >= max_gid_index) {
                            global_gid_max_index = max_gid_index;
                        }
                    }
                })
            }
        } else {
            global_gid_max_index = 0;
        }
    })
});

paypal.configure({
  'mode': 'sandbox', //sandbox or live
  'client_id': 'AdC7s7JczOQQYi5ZY-j8CVfAp3l9FWIVoM_fFVT9TWZc24pKbOrREY7a5FkDvOZAR75Z5P1m1imAB_d1',
  'client_secret': 'EGICm2lIOTNvkbYuRGnIGxDMdUx3PzAIOKghJN48XPj5xKtCdA6wjNOAxjNblQaapWEMtcezaItag4wZ'
});

//setInterval(intervalFunc, 3000);


function between(min, max) {
    return Math.floor(
        Math.random() * (max - min) + min
    )
}

function createRandomStr(length) {
    var ret = ""
    var str = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    for (var i = 0; i < length; i++) {
        var index = between(0, 62)
        ret += str[index]
    }

    console.log("createRandomStr: " + ret);
    return ret
}

/* GET home page. */
router.get('/tenonvpn', function (req, res, next) {
    var sindex_str = "sindex.html";
    //var geo = geoip.lookup(req.connection.remoteAddress);
    if (false) {
        sindex_str = 'zh_CN/sindex.html'
    } else {
        sindex_str = 'en_US/sindex.html'
    }

    if (req.query.id != undefined && req.query.id != "") {
        const hash = crypto.createHash('sha256');
        hash.update(createRandomStr(2048));
        var share_key = hash.digest('hex');
        global_gen_key_dic.set(share_key, 1);
        sindex_str += "?id=" + req.query.id + "&share_key=" + share_key;
    }
    res.render('index', { title: 'tenonvpn', sindex: sindex_str });
});

router.get('/xsippool', function (req, res, next) {
    var sindex_str = 'zh_CN/ippool.html'
    if (req.query.id != undefined && req.query.id != "") {
        sindex_str += "?id=" + req.query.id;
    }
    res.render('index', { title: 'tenonvpn', sindex: sindex_str });
});

function send_http_request(ip, port, method, data) {
    axios.post('http://' + ip + ':' + port + '/' + method, JSON.stringify(data))
        .then(res => {
            console.log("get pay res: " + res["status"])
            return res;
        })
}

router.get('/shared_staking/:id', function (req, res, next) {
    
});


router.get('/', function (req, res, next) {
    var sindex_str = "sindex.html";
    //var geo = geoip.lookup(req.connection.remoteAddress);
    if (false) {
        sindex_str = 'zh_CN/sindex.html'
    } else {
        sindex_str = 'en_US/sindex.html'
    }

    if (req.query.id != undefined && req.query.id != "") {
        const hash = crypto.createHash('sha256');
        hash.update(createRandomStr(2048));
        var share_key = hash.digest('hex');
        global_gen_key_dic.set(share_key, 1);
        sindex_str += "?id=" + req.query.id + "&share_key=" + share_key;
    }
    res.render('index', { title: 'tenonvpn', sindex: sindex_str });
//    res.render('block_server', { title: 'block_server' });
});

router.get('/block_server', function (req, res, next) {
    res.render('block_server', { title: 'block_server' });
});

router.get('/transaction', function (req, res, next) {
    res.render('transaction', { title: 'lego transaction' });
});
router.get('/transaction/:acc_addr', function (req, res, next) {
    res.render('transaction', { title: 'lego transaction', account_addr: req.params[0] });
});
router.get('/statistics', function (req, res, next) {
    res.render('statistics', { title: 'lego statistics' });
});
router.get('/best_addr', function (req, res, next) {
    res.render('best_addr', { title: 'lego best_addr' });
});
router.get('/api', function (req, res, next) {
    res.render('api', { title: 'lego api' });
});

router.get('/get_country_load/:days', function (req, res, next) {
    let json_data = {
        "type": parseInt(req.params.days, 10)
    };
    axios.post('http://35.153.74.125:33343/get_country_load', JSON.stringify(json_data))
        .then(result => {
            res.send({ 'val': result.data["val"] });
        })
});
router.get('/get_day_alives', function (req, res, next) {
    let json_data = {};
    axios.post('http://35.153.74.125:33343/get_day_actives', JSON.stringify(json_data))
        .then(result => {
            res.send({ 'val': result.data["val"] });
        })
});

router.post('/list_transaction', function (req, res, next) {
    axios.post('http://35.153.74.125:33343/list_transaction', JSON.stringify(req.body))
        .then(result => {
            res.send(result.data);
        })
});

router.post('/get_transaction', function (req, res, next) {
            res.send(result.data);

    axios.post('http://35.153.74.125:33343/get_transaction', JSON.stringify(req.body))
        .then(result => {
            res.send(result.data);
        })

});

router.post('/do_transaction', function (req, res, next) {
    axios.post('http://35.153.74.125:33343/transaction', JSON.stringify(req.body))
        .then(result => {
            res.send(result.data);
        })
});

router.post('/account_balance', function (req, res, next) {
    axios.post('http://35.153.74.125:33343/account_balance', JSON.stringify(req.body))
        .then(result => {
            res.send(result.data);
        })
});

router.post('/account_balance', function (req, res, next) {

    axios.post('http://35.153.74.125:33343/get_transaction', JSON.stringify(req.body))
        .then(result => {
            res.send(result.data);
        })

});

router.post('/account_balance', function (req, res, next) {
    axios.post('http://35.153.74.125:33343/get_transaction', JSON.stringify(req.body))
        .then(result => {
            res.send(result.data);
        })
});

router.post('/tx_info', function (req, res, next) {
    axios.post('http://35.153.74.125:33343/tx_info', JSON.stringify(req.body))
        .then(result => {
            res.send(result.data);
        })
});

router.post('/tongji_info', function (req, res, next) {
    axios.post('http://35.153.74.125:33343/tongji_info', JSON.stringify(req.body))
        .then(result => {
            res.send(result.data);
        })
});

router.post('/statistics', function (req, res, next) {
    axios.post('http://35.153.74.125:33343/statistics', JSON.stringify(req.body))
        .then(result => {
            res.send(result.data);
        })
});

router.post('/best_addr', function (req, res, next) {
    axios.post('http://35.153.74.125:33343/best_addr', JSON.stringify(req.body))
        .then(result => {
            res.send(result.data);
        })
});

router.post('/share_reward', function (req, res, next) {
    var share_key = req.body.share_key;
    if (!global_gen_key_dic.has(share_key)) {
        return;
    }

    global_gen_key_dic.delete(share_key);
    var gid_src = for_gid_random_str + req.connection.remoteAddress;
    const hash = crypto.createHash('sha256');
    hash.update(gid_src);
    let req_data = {
        "prikey": "f9dab39f53958adba1e2f74b5c224a52d920f8494121590e439e9d06a6d9a2d7",
        "to": req.body.acc_addr,
        "gid": hash.digest('hex'),
        "src_dht_key": "",
        "amount": 16
    };

    console.log("new share reward: " + req.connection.remoteAddress + ", id: " + req.body.acc_addr + ", ips: " + JSON.stringify(req.ips) + ", share key: " + share_key);
  send_http_request("127.0.0.1", 33343, "local_transaction", req_data);
});

function itunesPost(data,type,cb) {
    //环境判断 线上/开发环境用不同的请求链接
    var url = ""
    if (type == 0) {
        url = "https://sandbox.itunes.apple.com/verifyReceipt" //沙盒测试
    } else {
        url = "https://buy.itunes.apple.com/verifyReceipt" //线上测试
    }
     
    url = "https://buy.itunes.apple.com/verifyReceipt" //线上测试
    var receiptData = {};
    receiptData['receipt-data'] = data;
    receiptData['password'] = "726be3fda0c84fcb8d8792344a1e53c2";
    
    let post_data = JSON.stringify(receiptData);

    axios.post(url, post_data)
    .then(result => {
        cb(result.data)
    })
}
router.get('/file/:fileName/:id', function (req, res, next) {
    var fileName = req.params.fileName;
    var filePath = path.join(__dirname, fileName);
    var stats = fs.statSync(filePath);
    if (stats.isFile()) {
        res.set({
            'Content-Type': 'application/octet-stream',
            'Content-Disposition': 'attachment; filename=' + fileName,
            'Content-Length': stats.size
        });
        fs.createReadStream(filePath).pipe(res);
        if (req.params.id.length == 64) {
            let req_data = { "acc_addr": req.params.id, "price": 1.0, "gid": "" }
            send_http_request("127.0.0.1", 33343, "shared_staking", req_data)
        }
    } else {
        res.end(409);
    }
});


// check gid is blocked
function intervalFunc() {
  db.get("gid_min_index", function(err, value) {
      var min_gid_index = 0;
      if (!err) {
          min_gid_index = parseInt(value);
      }

      db.get("gid_max_index", function(err, max_val) {
          var max_gid_index = 0;
          if (!err) {
              max_gid_index = parseInt(max_val);
          }

          for (; min_gid_index < max_gid_index; ++min_gid_index) {
              if (global_index_arr.has(min_gid_index)) {
                  db.put("gid_min_index", min_gid_index + 1);
                  continue
              }

              break;
          }

          console.log("get min_gid_index:" + min_gid_index + ", max gid index: " + max_gid_index);
          for (var i = min_gid_index; i < max_gid_index; ++i) {
              // get gid blocks and remove min
              var queue_key = "gid_index" + i;
              db.get(queue_key, function(err, val) {
                  if (!err) {
                      var block_req = {};
                      block_req['tx_gid'] = val;
                      axios.post('http://35.153.74.125:33343/get_transaction', JSON.stringify(block_req))
                          .then(result => {
                              if (result.status == 201) {
                                  db.get(result.data, function(err, req_val) {
                                      if (!err) {
                                          var val_split = req_val.split("----");
                                          if (val_split.length != 2) {
                                               console.log("FFFFFFFFFFFFFF fatal to restart transaction for lost gid: " + req_val);
                                          } else {
                                               send_http_request("127.0.0.1", 33343, "local_transaction", JSON.parse(val_split[1]));
                                          }
                                      } else {
                                          console.log("FFFFFFFFFFFFFF fatal to restart transaction for lost gid.");
                                      }
                                  })
                              } else {
                                  var gid_index_key = result.data["tx_list"][0]["tx_gid"] + "_with_index";
                                  db.get(gid_index_key, function(err, val) {
                                      if (!err) {
                                          global_index_arr.set(parseInt(val), val);
                                      } else {
                                          console.log("200 failed TTTTTT: " + val);
                                      }
                                  })
                              }
                          })
                  } else {
                      var split_item1 = err.toString().split("gid_index");
                      if (split_item1.length == 2) {
                          var split_item2 = split_item1[1].split("]");
                          if (split_item2.length > 0) {
                              global_index_arr.set(parseInt(split_item2[0]), split_item2[0]);
                          }
                      }
                  }
              })
          }
      })
  })
}

function CheckGidExists(gid, gid_val) {
    if (global_added_gid.has(gid)) {
        return;
    }

    global_added_gid.set(gid, gid);
    var queue_key = "gid_index" + global_gid_max_index;
    var ops = [
        { type: 'put', key: gid, value: gid_val },
        { type: 'put', key: queue_key, value: gid },
        { type: 'put', key: gid + "_with_index", value: global_gid_max_index },
        { type: 'put', key: 'gid_max_index', value: (global_gid_max_index + 1) },
    ]

    global_gid_max_index += 1;
    db.batch(ops, function (err) {
        if (err) return console.log('CheckGidExists Ooops!', err)
    })
}

router.post('/braintree_client_callback', function (req, res, next) {
    console.log("TTTTTTTTT braintree_client_callback called." + req.body.amount + ", " + req.body.nonce);
    //    global_paypal_callback_dic
    if (req.body.email.length > 0) {
        global_paypal_callback_dic[req.body.email] = req.body.id;
        global_paypal_nonce_dic[req.body.email] = req.body.nonce;
    } else if (req.body.phone.length > 0) {
        global_paypal_callback_dic[req.body.phone] = req.body.id;
        global_paypal_nonce_dic[req.body.phone] = req.body.nonce;
    } else {
        console.log("paypal_callback error." + JSON.stringify(req.body));
        res.send("404");
        return;
    }

    gateway.transaction.sale({
        amount: req.body.amount,
        paymentMethodNonce: req.body.nonce,
        options: {
            submitForSettlement: true
        }
    }).then(function (result) {
        if (result.success) {
            console.log("result.transaction success." + JSON.stringify(result.transaction));
            var nonce = "";
            if (result.transaction.paypalAccount.payerEmail &&
                    result.transaction.paypalAccount.payerEmail.length > 0 &&
                global_paypal_nonce_dic[result.transaction.paypalAccount.payerEmail]) {
                nonce = global_paypal_nonce_dic[result.transaction.paypalAccount.payerEmail];
            }

            if (nonce.length <= 0) {
                if (result.transaction.paypalAccount.payerPhone &&
                        result.transaction.paypalAccount.payerPhone.length > 0 &&
                    global_paypal_nonce_dic[result.transaction.paypalAccount.payerPhone]) {
                    nonce = global_paypal_nonce_dic[result.transaction.paypalAccount.payerPhone];
                }
            }

            var gid_src = for_gid_random_str + nonce;
            const hash = crypto.createHash('sha256');
            hash.update(gid_src);
            var charge_amount = parseFloat(result.transaction.amount);
            var amount = 0;
            if (charge_amount < 10.0) {
                amount = 2050;
            } else if (charge_amount < 20.0) {
                amount = 6010;
            } else if (charge_amount < 80.0) {
                amount = 23861;
            } else {
                console.log("paypal_callback error 0." + JSON.stringify(req.body));
                res.send("404");
                return;
            }

            var to = "";
            if (result.transaction.paypalAccount.payerEmail &&
                    result.transaction.paypalAccount.payerEmail.length > 0 &&
                    global_paypal_callback_dic[result.transaction.paypalAccount.payerEmail]) {
                to = global_paypal_callback_dic[result.transaction.paypalAccount.payerEmail];
            }

            if (to.length <= 0) {
                if (result.transaction.paypalAccount.payerPhone &&
                        result.transaction.paypalAccount.payerPhone.length > 0 &&
                        global_paypal_callback_dic[result.transaction.paypalAccount.payerPhone]) {
                    to = global_paypal_callback_dic[result.transaction.paypalAccount.payerPhone];
                }
            }

            if (to.length <= 0) {
                console.error("paypal_callback error 1." + JSON.stringify(result.transaction));
                res.send({ "status": 201, "err:": "to account error" })
                return;
            }

            let req_data = {
                "prikey": "7efc1c1dbdff1b6aeda232e25d3f00ab280dd0b3824a9bb4f840a69be35039b6",
                "to": to,
                "gid": hash.digest('hex'),
                "src_dht_key": "",
                "amount": amount
            };

            if (!global_added_gid.has(req_data.gid)) {
                CheckGidExists(req_data.gid, + "no----" + JSON.stringify(req_data));
                send_http_request("127.0.0.1", 33343, "local_transaction", req_data);
                console.log("paypal_callback success gid: " + req_data.gid);
            } else {
                console.log("paypal_callback error 2." + req_data.gid);
            }
            res.send({ "status": 200, "tx_id": result.transaction.id});
        } else {
            console.error("paypal_callback error 3." + result.message);
            res.send({ "status": 201, "err:": result.message })
        }
    }).catch(function (err) {
        console.error("paypal_callback error 4." + err.toString());
        res.send({ "status": 201, "err:": err.toString() })
    });

    res.send({ "status": 200 });
});

router.post('/paypal_callback', function (req, res, next) {
    console.log("TTTTTTTTT paypal_callback called.");
    res.send({ "status": 200 })
    return;
    if (global_gid_min_index < 0 || global_gid_max_index < 0) {
        res.send("404");
        return;
    }

    /*
    try {
        var gid_src = for_gid_random_str + between(1, 1000)
        const hash = crypto.createHash('sha256');
        hash.update(gid_src);
        let req_data = {
            "prikey": "7efc1c1dbdff1b6aeda232e25d3f00ab280dd0b3824a9bb4f840a69be35039b6",
            "to": "12154b9925d1ba3607c2179c28fb03964637fae4c6a1d12bca1f588074031e43",
            "gid": hash.digest('hex'),
            "src_dht_key": "",
            "amount": 50
        };

        send_http_request("127.0.0.1", 33343, "local_transaction", req_data);
        res.send({ "status": 200 })
    } catch (error) {
        console.log("paypal_callback error." + error);
    }
    return;
    */
    try {
        paypal.notification.webhookEvent.getAndVerify(JSON.stringify(req.body), function (error, response) {
            if (error) {
                console.log("paypal_callback error.");
                throw error;
            } else {
                if (response) {
                    if (req.body.resource.state == "approved" || req.body.resource.state == "APPROVED") {
                        var gid_src = for_gid_random_str + req.body.resource.parent_payment
                        const hash = crypto.createHash('sha256');
                        hash.update(gid_src);
                        var amount = 0;
                        if (req.body.resource.transactions[0].amount.total < 12.0) {
                            amount = 2050;
                        } else if (req.body.resource.transactions[0].amount.total < 30.0) {
                            amount = 6010;
                        } else if (req.body.resource.transactions[0].amount.total < 80.0) {
                            amount = 23861;
                        } else {
                            console.log("paypal_callback error." + JSON.stringify(req.body));
                            res.send("404");
                            return;
                        }

                        let req_data = {
                            "prikey": "7efc1c1dbdff1b6aeda232e25d3f00ab280dd0b3824a9bb4f840a69be35039b6",
                            "to": req.body.resource.transactions[0].description,
                            "gid": hash.digest('hex'),
                            "src_dht_key": "",
                            "amount": amount
                        };

                        if (!global_added_gid.has(req_data.gid)) {
                            CheckGidExists(req_data.gid, JSON.stringify(req.body) + "----" + JSON.stringify(req_data));
                            //db.put(req_data.gid, JSON.stringify(req.body) + "----" + JSON.stringify(req_data))
                            send_http_request("127.0.0.1", 33343, "local_transaction", req_data);
                        }
                    } else {
                        console.log("get paypal_callback completed: " + JSON.stringify(req.body))
                    }
                    res.send({ "status": 200 })
                } else {
                    console.log("paypal_callback error.");
                }
            }
        });
    } catch (error) {
        console.log("paypal_callback error." + error);
    }
});


router.post('/appleIAPAuth', function (req, res, next) {
    var message = "验证失败"
    var status = -1
    if (global_gid_min_index < 0 || global_gid_max_index < 0) {
        res.send({ status, message })
        return;
    }

    if (req.body.ver != "tenonvpn_5.0.2_official") {
        console.log("invalid version");
        return;
    }
    var gid = sha256(req.body.receipt)
    db.get(gid, function (err, value) {
        if (!err) {
            console.log("get old gid: " + gid + ":" + value)
        }
    })

    itunesPost(req.body.receipt,0,function (responseData) {
        var purcaseTime = 0;
        var status = 0;
        if(responseData.status == 0){
            console.log("验证成功")
            status = 1
            var retCode = 0
            retCode = sendPost(req.body.account, gid, req.body.type, function (respStatusCode){
                if (respStatusCode != 200) {
                    status = respStatusCode
                    message = "验证失败"
                    res.send({ status, message })
                }
                else{
                    res.send({ status, message })
                }
            })
        }else{
            res.send({ status, message })
        }
    });
});

function sendPost(to,gid,type,cb){
    var data = {};
    var amount = 1
    if (type == 1){
        // 月会员扣费金额
        amount = 2052
    }else if (type == 2){
        // 季度会员扣费金额
        amount = 6012
    }else if (type == 3){
        // 年会员扣费金额
        amount = 23862
    }else{
        amount = 2052
    }
    data['data'] = {to,gid,amount}
    let post_data = JSON.stringify(data)

    let req_data = {
        "prikey": "7efc1c1dbdff1b6aeda232e25d3f00ab280dd0b3824a9bb4f840a69be35039b6",
        "to": to,
        "gid": gid,
        "src_dht_key": "",
        "amount": amount
    };

    if (!global_added_gid.has(gid)) {
        CheckGidExists(gid, type + "----" + JSON.stringify(req_data));
        send_http_request("127.0.0.1", 8787, "local_transaction", req_data);
    }

    cb(200);
}

router.get('/pp_one_month/:id', function (req, res, next) {
    res.redirect("https://jhsx123456789.xyz:14431/pp_one_month/" + req.params.id);
    return
    console.log("pp_one_month called: " + req.params.id);
    var http_url = "https://api-3t.paypal.com/nvp?" +
        "USER=tchaindapp_api1.gmail.com&" +
        "PWD=VZ8LLWXW5HD6T8PQ&SIGNATURE=A6YGUhkhKoIyu6Lvoifl.Vu0yJfwAgvQ30VbGPy3VQavNEtn-UhGytE0&" +
        "METHOD=SetExpressCheckout&" +
        "VERSION=124.0&" +
        "RETURNURL=http://" + server_info + "/return&" +
        "CANCELURL=http://" + server_info + "/cancel&" +
        "PAYMENTREQUEST_0_PAYMENTACTION=Sale&" +
        "PAYMENTREQUEST_0_AMT=5.0&" +
        "PAYMENTREQUEST_0_CURRENCYCODE=USD&" +
        "PAYMENTREQUEST_0_DESC=one_month_vip&" +
        "L_PAYMENTREQUEST_0_NAME0=one_month_vip&" +
        "L_PAYMENTREQUEST_0_DESC0=one_month_vip&" +
        "L_PAYMENTREQUEST_0_AMT0=5.0&" +
        "L_PAYMENTREQUEST_0_QTY0=0&" +
        "L_PAYMENTREQUEST_0_TAXAMT0=0&" +
        "L_PAYMENTREQUEST_0_NUMBER0=0&" +
        "L_PAYMENTREQUEST_0_ITEMURL0=0&" +
        "L_PAYMENTREQUEST_0_ITEMCATEGORY0=Physical"
    var request = require('request');
    console.log("paypal :" + http_url);
    request(http_url, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            var tmp_body = decodeURI(body)
            console.log("paypal get decode body: " + tmp_body);

            var res_split = tmp_body.split("&");
            var ec_tocken = '';
            for (var i = 0; i < res_split.length; ++i) {
                var item_split = res_split[i].split("=");
                if (item_split.length == 2 && item_split[0] == "TOKEN") {
                    tocken_map.set(item_split[1], req.params.id);
                    tocken_price_map.set(item_split[1], 30);
                    payItemMap.set(item_split[1], new PayItem(item_split[1], "", "", 1, 30, req.params.id))
                    ec_tocken = item_split[1];
                }

                if (item_split.length == 2 && item_split[0] == "ACK") {
                    if (item_split[1] != "Success") {
                        console.log("paypal pay token status failed: " + params.token + ":" + params.PayerID + ", status: " + item_split[1]);
                        res.render('error500.html', { title: 'pay error' });
                        return;
                    }
                }
            }

            if (ec_tocken == '') {
                console.log("paypal pay token ec_tocken failed: " + params.token + ":" + params.PayerID);
                res.render('error500.html', { title: 'pay error' });
                return;
            }
            console.log("paypal :" + ec_tocken + ":" + req.params.id)
            res.redirect("https://www.paypal.com/checkoutnow?token=" + ec_tocken);
        } else {
            console.log("request paypal error: " + error);
        }
    });
});

router.get('/pp_six_month/:id', function (req, res, next) {
    res.redirect("https://jhsx123456789.xyz:14431/pp_six_month/" + req.params.id);
    return
    var http_url = "https://api-3t.paypal.com/nvp?" +
        "USER=tchaindapp_api1.gmail.com&" +
        "PWD=VZ8LLWXW5HD6T8PQ&SIGNATURE=A6YGUhkhKoIyu6Lvoifl.Vu0yJfwAgvQ30VbGPy3VQavNEtn-UhGytE0&" +
        "METHOD=SetExpressCheckout&" +
        "VERSION=124.0&" +
        "RETURNURL=http://" + server_info + "/return&" +
        "CANCELURL=http://" + server_info + "/cancel&" +
        "PAYMENTREQUEST_0_PAYMENTACTION=Sale&" +
        "PAYMENTREQUEST_0_AMT=12.0&" +
        "PAYMENTREQUEST_0_CURRENCYCODE=USD&" +
        "PAYMENTREQUEST_0_DESC=six_month_pay&" +
        "L_PAYMENTREQUEST_0_NAME0=six_month_vip&" +
        "L_PAYMENTREQUEST_0_DESC0=six_month_vip&" +
        "L_PAYMENTREQUEST_0_AMT0=12.0&" +
        "L_PAYMENTREQUEST_0_QTY0=0&" +
        "L_PAYMENTREQUEST_0_TAXAMT0=0&" +
        "L_PAYMENTREQUEST_0_NUMBER0=0&" +
        "L_PAYMENTREQUEST_0_ITEMURL0=0&" +
        "L_PAYMENTREQUEST_0_ITEMCATEGORY0=Physical"
    var request = require('request');
    console.log("paypal :" + http_url);
    request(http_url, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            var tmp_body = decodeURI(body)
            console.log("paypal get decode body: " + tmp_body);

            var res_split = tmp_body.split("&");
            var ec_tocken = '';
            for (var i = 0; i < res_split.length; ++i) {
                var item_split = res_split[i].split("=");
                if (item_split.length == 2 && item_split[0] == "TOKEN") {
                    tocken_map.set(item_split[1], req.params.id);
                    tocken_price_map.set(item_split[1], 144);
                    payItemMap.set(item_split[1], new PayItem(item_split[1], "", "", 1, 144, req.params.id))
                    ec_tocken = item_split[1];
                }

                if (item_split.length == 2 && item_split[0] == "ACK") {
                    if (item_split[1] != "Success") {
                        console.log("pay token status failed: " + params.token + ":" + params.PayerID, ", status: " + item_split[1]);
                        res.render('error500.html', { title: 'pay error' });
                        return;
                    }
                }
            }

            if (ec_tocken == '') {
                console.log("paypal pay token ec_tocken failed: " + params.token + ":" + params.PayerID);
                res.render('error500.html', { title: 'pay error' });
                return;
            }
            console.log("paypal : " + ec_tocken + ":" + req.params.id)
            res.redirect("https://www.paypal.com/checkoutnow?token=" + ec_tocken);
        } else {
            console.log("request paypal error: " + error);
        }
    });
});

router.get('/pp_one_year/:id', function (req, res, next) {
    res.redirect("https://jhsx123456789.xyz:14431/pp_one_year/" + req.params.id);
    return
    var http_url = "https://api-3t.paypal.com/nvp?" +
        "USER=tchaindapp_api1.gmail.com&" +
        "PWD=VZ8LLWXW5HD6T8PQ&SIGNATURE=A6YGUhkhKoIyu6Lvoifl.Vu0yJfwAgvQ30VbGPy3VQavNEtn-UhGytE0&" +
        "METHOD=SetExpressCheckout&" +
        "VERSION=124.0&" +
        "RETURNURL=http://" + server_info + "/return&" +
        "CANCELURL=http://" + server_info + "/cancel&" +
        "PAYMENTREQUEST_0_PAYMENTACTION=Sale&" +
        "PAYMENTREQUEST_0_AMT=36.0&" +
        "PAYMENTREQUEST_0_CURRENCYCODE=USD&" +
        "PAYMENTREQUEST_0_DESC=one_year_vip&" +
        "L_PAYMENTREQUEST_0_NAME0=one_year_vip&" +
        "L_PAYMENTREQUEST_0_DESC0=one_year_vip&" +
        "L_PAYMENTREQUEST_0_AMT0=36.0&" +
        "L_PAYMENTREQUEST_0_QTY0=0&" +
        "L_PAYMENTREQUEST_0_TAXAMT0=0&" +
        "L_PAYMENTREQUEST_0_NUMBER0=0&" +
        "L_PAYMENTREQUEST_0_ITEMURL0=0&" +
        "L_PAYMENTREQUEST_0_ITEMCATEGORY0=Physical"
    var request = require('request');
    console.log("paypal :" + http_url);
    request(http_url, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            var tmp_body = decodeURI(body)
            console.log("paypal get decode body: " + tmp_body);
            var res_split = tmp_body.split("&");
            var ec_tocken = '';
            for (var i = 0; i < res_split.length; ++i) {
                var item_split = res_split[i].split("=");
                if (item_split.length == 2 && item_split[0] == "TOKEN") {
                    tocken_map.set(item_split[1], req.params.id);
                    tocken_price_map.set(item_split[1], 216);
                    payItemMap.set(item_split[1], new PayItem(item_split[1], "", "", 1, 216, req.params.id))
                    ec_tocken = item_split[1];
                }

                if (item_split.length == 2 && item_split[0] == "ACK") {
                    if (item_split[1] != "Success") {
                        console.log("pay token status failed: " + params.token + ":" + params.PayerID + ", status: " + item_split[1]);
                        res.render('error500.html', { title: 'pay error' });
                        return;
                    }
                }
            }

            if (ec_tocken == '') {
                console.log("paypal pay token ec_tocken failed: " + params.token + ":" + params.PayerID);
                res.render('error500.html', { title: 'pay error' });
                return;
            }
            console.log("paypal : " + ec_tocken + ":" + req.params.id)
            res.redirect("https://www.paypal.com/checkoutnow?token=" + ec_tocken);
        } else {
            console.log("request paypal error: " + error);
        }
    });
});

router.get('/return', function (req, res, next) {
    console.log("paypal return called: " + req.query);
    var params = req.query
    var http_url = "https://api-3t.paypal.com/nvp?" +
        "USER=tchaindapp_api1.gmail.com&" +
        "PWD=VZ8LLWXW5HD6T8PQ&SIGNATURE=A6YGUhkhKoIyu6Lvoifl.Vu0yJfwAgvQ30VbGPy3VQavNEtn-UhGytE0&" +
        "METHOD=GetExpressCheckoutDetails&VERSION=124.0&TOKEN=" + params.token;
    var request = require('request');
    console.log("paypal :" + http_url);
    request(http_url, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            var tmp_body = decodeURI(body)
            var res_split = tmp_body.split("&");
            console.log("paypal client info: " + tmp_body);
            for (var i = 0; i < res_split.length; ++i) {
                var item_split = res_split[i].split("=");
                if (item_split.length == 2 && item_split[0] == "ACK") {
                    if (item_split[1] != "Success") {
                        console.log("status  failed: " + params.token + ":" + params.PayerID + ", status: " + item_split[1]);
                        res.render('error500.html', { title: 'pay error' });
                        return;
                    }
                    break;
                }
            }

            var token = params.token;
            var account_id = tocken_map.get(params.token);
            var price = tocken_price_map.get(params.token);
            tocken_map.delete(params.token);
            tocken_price_map.delete(params.token);
            var payerid = params.PayerID;
            if (account_id == undefined || account_id == "") {
                console.log("paypal pay token get account id failed: " + token + ":" + payerid + ", id: " + account_id);
                res.render('error500.html', { title: 'pay error' });
                return;
            }

            var amt = 0.0;
            if (price == 30) {
                amt = 5.0;
            } else if (price == 144) {
                amt = 12.0;
            } else if (price == 216) {
                amt = 36.0;
            } else {
                console.log("paypal pay token price failed: " + token + ":" + payerid + ", price: " + price);
                res.render('error500.html', { title: 'pay error' });
                return;
            }

            var http_url = "https://api-3t.paypal.com/nvp?" +
                "USER=tchaindapp_api1.gmail.com&" +
                "PWD=VZ8LLWXW5HD6T8PQ&SIGNATURE=A6YGUhkhKoIyu6Lvoifl.Vu0yJfwAgvQ30VbGPy3VQavNEtn-UhGytE0&" +
                "METHOD=DoExpressCheckoutPayment&" +
                "VERSION=124.0&" +
                "TOKEN=" + token + "&" +
                "PAYMENTREQUEST_0_PAYMENTACTION=Sale&" +
                "PAYERID=" + payerid + "&" +
                "PAYMENTREQUEST_0_AMT=" + amt + "&" +
                "PAYMENTREQUEST_0_ITEMAMT=0&" +
                "PAYMENTREQUEST_0_SHIPPINGAMT=0&" +
                "PAYMENTREQUEST_0_TAXAMT=0&" +
                "PAYMENTREQUEST_0_CURRENCYCODE=USD&" +
                "PAYMENTREQUEST_0_DESC=TenonVpn VIP&" +
                "L_PAYMENTREQUEST_0_NAME0=TenonVpn VIP&" +
                "L_PAYMENTREQUEST_0_AMT0=" + amt + "&" +
                "L_PAYMENTREQUEST_0_QTY0=0";
            console.log("paypal DoExpressCheckoutPayment:" + http_url);
            request(http_url, function (error, response, body) {
                if (!error && response.statusCode == 200) {
                    var tmp_body = decodeURI(body)
                    console.log("paypal pay result info: " + tmp_body);
                    var res_split = tmp_body.split("&");
                    for (var i = 0; i < res_split.length; ++i) {
                        var item_split = res_split[i].split("=");
                        if (item_split.length == 2 && item_split[0] == "ACK") {
                            if (item_split[1] != "Success") {
                                console.log("pay token status failed: " + params.token + ":" + params.PayerID + ", status: " + item_split[1]);
                                res.render('error500.html', { title: 'pay error' });
                                return;
                            }
                            break;
                        }
                    }

                    var gid_src = for_gid_random_str + token;
                    const hash = crypto.createHash('sha256');
                    hash.update(gid_src);
                    var amount = 0;
                    if (price == 30) {
                        amount = 2050;
                    } else if (price == 144) {
                        amount = 6010;
                    } else if (price == 216) {
                        amount = 23861;
                    } else {
                        console.log("paypal paypal_callback price error." + JSON.stringify(req.body) + ", price: " + price);
                        res.render('error500.html', { title: 'pay error' });
                        return;
                    }

                    let req_data = {
                        "prikey": "7efc1c1dbdff1b6aeda232e25d3f00ab280dd0b3824a9bb4f840a69be35039b6",
                        "to": account_id,
                        "gid": hash.digest('hex'),
                        "src_dht_key": "",
                        "amount": amount
                    };

                    if (!global_added_gid.has(req_data.gid)) {
                        console.log("paypal real pay : " + amount);
                        CheckGidExists(req_data.gid, "paypal----" + JSON.stringify(req_data));
                        send_http_request("127.0.0.1", 8787, "local_transaction", req_data);
                    }

                    res.render('return_confirm.html', {
                        title: 'pay success',
                        id: account_id,
                        token: token,
                        payerid: payerid,
                        vip_type: 1,
                        vip_days: 1,
                        vip_off: 1,
                        vip_money: 1,
                    });
                } else {
                    console.log("paypal pay token get account id failed: " +
                        token + ":" + payerid + ":" + account_id + ":" + price);
                    res.render('error500.html', { title: 'pay error' });
                }
            });
        } else {
            console.log("paypal return error: ");
            res.render('error500.html', { title: 'pay error' });
        }
    });
});

router.get('/cancel', function (req, res, next) {
    console.log("cancel called: ");
    res.render('pay_cancel.html', { title: 'pay cancel' });
});

module.exports = router;

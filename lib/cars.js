const net = require('net')
const log = require('log4js').getLogger('cars')
const JT808 = require('./jt808')

const jt808 = new JT808()

// 网络状态定义 
const NET_CLOSED = 'CLOSED'
const NET_CONING = 'CONING'
const NET_LINKED = 'LINKED'

const total = {
    link: 0, // 连接成功的
    send: 0, // 成功发送的
    recv: 0, // 收到的
    penc: 0, // 连接待决
}

var connWaitList = []
var lastRefused  = 0
var lastConnOK   = false

function statInfo(conf){
    const wait_count = connWaitList.length

    return '总数:'+conf.nums +' =('
    + (total.link>0?' 已连:'+total.link:'')
    + (total.penc>0?' 未定:'+total.penc:'') 
    + (wait_count>0?' 排队:'+wait_count:'') 
    +' )' 
    +(total.send>0?' 已发:'+total.send:'') 
    +(total.recv>0?' 已收:'+total.recv:'')
}

// 整数转换为12位字符串
function intToStr12(val){
    var res = new Array()
    var ss = val.toString()
    for(var i=ss.length;i<12;i++){
        res.push("0")
    }
    for(var i=0;i<ss.length;i++){
        res.push(ss[i])
    }
    return res.join("")
}


function Car(seq,key,raws,conf){
    this.conf = conf
    this.raws = raws
    this.seq  = seq
    this.key  = key
    this.code = Buffer.from(key,'hex')
    this.cmdq = 0

    this.try = 0
    this.sts = NET_CLOSED

    this.sock = new net.Socket()
    const sock = this.sock
    
    sock.on('connect', ()=>{
        if(!lastConnOK){
            log.info('开始有连接成功')
        }
        
        lastConnOK = true
        lastRefused = 0
        
        total.link++
        total.penc--

        this.sts = NET_LINKED
        //if(this.seq % 100 ==0) log.info('[%d][%s] connected, links:%d', this.seq, this.key, total.link)
    })

    sock.on('error', (err)=>{
        log.error('[%s] (%s -----> ?? ): [%s:%d] %s, %s'
            , this.toString(), this.sts
            , conf.host, conf.port
            , statInfo(conf), err.code
            )

        // 发起连接时出现错误，要看具体情况
        if(NET_CONING == this.sts){
            lastRefused = Date.now()
            if(lastConnOK){
                log.info('开始有连接失败')
            }
            lastConnOK = false
        }

    })

    sock.on('close', (bad_err)=>{
        log.warn(' [%s] (%s ==> CLOSED): [%s:%d] %s', this.toString(), this.sts, conf.host, conf.port, statInfo(conf))

        if(NET_LINKED == this.sts){
            total.link--
        }else if(NET_CONING == this.sts){
            total.penc--
        }

        // 连接断开后，重新放入待连接队列
        this.sts = NET_CLOSED
        connWaitList.push(this)
    })

    sock.on('data',(data)=>{
        total.recv++
        if(conf.echo)
            log.info('[%d][%s] <<== CMD [%s]', this.seq, this.key, data.toString('hex'))
    })

}

Car.prototype = {
    constructor: typeof Car,

    tryConn: function(conf){
        if(NET_CLOSED == this.sts){
            total.penc++
            this.try++
            this.sts = NET_CONING
            this.sock.connect(conf.port, conf.host)
        }else if (NET_CONING == this.sts){
            log.info('......', this)
        }
    },

    trySend : function(buf){
        if(this.conf.echo)
            log.info('[%d][%s] DAT ==>> [%s]', this.seq, this.key, buf.toString('hex'))
        this.sock.write(buf)
        total.send++
    },

    toString : function(){
        return this.seq+':'+this.key
    },

    makeRaw : function(time){
        return jt808.makeRaw(
            time
            , this.code
            , this.raws.next()
            , this.cmdq++ & 0xFFFF
            )
    },
}

function Cars(conf){
    this.conf = conf
    this.addr = '['+conf.host+':'+conf.port+']'
    this.cars = new Array(conf.nums)

    this.statInfo = function(){ 
        return statInfo(conf) 
    }

	this.checkConn = function(batch){
        if(connWaitList.length > 0){
            // 上次拒绝连接不到 n秒，不要再尝试连接
            if( Date.now() - lastRefused < 3000){
                //log.info('skip try conn for to more refused')
                return
            }

            // 上次连接是失败，先连接一个看看
            if(!lastConnOK){
                const car = connWaitList.shift()
                car.tryConn(conf)
                log.info(' [%s] (CLOSED ==> CONING): %s %s, 尝试连接', car.toString(), this.addr, this.statInfo())
                return
            }

            if(total.penc>batch){
                //log.info('稍后再连，待定: %d', total.penc)
                return
            }

            const count = Math.min(batch, connWaitList.length)
            log.info('批量连接: %s, %s', count, this.statInfo())

            // 每次找出 N 个客户端进行连接，一次连接太多容易导致报错
            for(i=0; i<count; i++){
                connWaitList.shift().tryConn()
            }
        }
	}

	this.checkSend = function(){
        if(total.link < this.conf.nums){
            log.warn('还有连接未完成，%s', this.statInfo())
            return
        }

		const time = jt808.getTime()
        //log.info('现发送 %d [%s]', raws.idx, buff.toString('hex').toUpperCase())
        
		for(var i=0; i<this.conf.nums; i++){
            const car = this.cars[i]
            if(NET_LINKED==car.sts){
                const buf = car.makeRaw(time)
                car.trySend(buf)
            }
		}
	}

    this.setup = function(srcs){
        if(this.conf.nums>1){
            log.info('create cars: [%s ~ %s]'
            , intToStr12(this.conf.keys)
            , intToStr12(this.conf.keys+this.conf.nums))
        }else{
            log.info('create car: [%s]', intToStr12(this.conf.keys))
        }

        for(var i = 0; i< this.conf.nums; i++){
            const key = intToStr12(i+this.conf.keys)
            const raws = srcs.nextRaws().copy()
            const car = new Car(1+i, key, raws, this.conf)
            this.cars[i] = car
            connWaitList.push(car)
        }
    }

}

module.exports = Cars
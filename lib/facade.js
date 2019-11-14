

const log4js = require('log4js')

const lgcf = {
    appenders:{
        file:{
            type: 'dateFile',
            filename: './logs/devps',
            pattern: 'yyyy-MM-dd.log',
            alwaysIncludePattern: true
        }
    },

    categories:{
        default:{
            appenders:['file'],
            level: 'DEBUG'
        }
    }
}

const argv = require('yargs')
    .option('e', {demand: true, type: 'boolean', default:'false'}) // 显示指令
    .option('v', {demand: true, type: 'boolean', default:'false'}) // 显示控制台
    .option('h', {demand: false, type: 'string'})
    .option('p', {demand: false, type: 'integer'})
    .option('q', {demand: false, type: "integer"})
    .argv

if(argv.v && argv.v==true){ // 只显示控制台信息，不生成文件
    console.log('控制台模式运行')
    delete lgcf.appenders.file
    lgcf.appenders.console = {
        type: 'console'
    }
    lgcf.categories.default.appenders[0] = 'console'
}else{
    delete lgcf.appenders.console
}

const log = log4js.configure(lgcf).getLogger('devp')

const Srcs  = require('./srcs')
const Cars  = require('./cars')
const JT808 = require('./jt808')

function Facade(conf){
    if(argv.h) conf.host = argv.h
    if(argv.p) conf.port = argv.p
    if(argv.q) conf.freq = argv.q
    if(argv.e) conf.echo = argv.e

    log.info('conf=', conf)

    this.srcs = new Srcs(new JT808())
    this.cars = new Cars(conf)

    this.tStart = Date.now()
    this.tipAlive = function(){
        const mils = Date.now() - this.tStart

        var d=0,h=0,m=0, s=Math.round(mils/1000)

        while(s>86400){d++, s-=86400}
        while(s>3600){h++, s-=3600}
        while(s>60){m++, s-=60}

        const msg = '已运行 [ '+(d>0?(d+'天'):'')+ (h>0?(h+'时'):'')+ (m>0?(m+'分'):'')+ (s>0?(s+'秒'):'')+ ' ] '
            + this.cars.statInfo() 
    
		log.info(msg)
    }

	this.run = function(){
        this.cars.setup(this.srcs)

        setInterval(() => this.cars.checkConn(500), 200)
        setInterval(() => this.cars.checkSend(), 1000*conf.freq)
        setInterval(() => this.tipAlive(), 1000 * 5);
    }

    // 启动
    {
        log.info('setup')
        this.srcs.loadPath(conf.raws, ()=>{
            this.run()
        })
    }
}

module.exports = Facade
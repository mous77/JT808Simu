

const fs = require('fs')
const log = require('log4js').getLogger('srcs')
const Raws = require('./raws')

/**
 * 多个源
 */
function Srcs(jt808){
    this.index = 0
    this.rawsAry = []

    this.nextRaws = function(){
        const raws = this.rawsAry[this.index]
        this.index = this.index++ % this.rawsAry.length
        return raws
    }

    // 加载一个原始数据文件
    this.loadFile = function(fname, callback){
        if(!fs.existsSync(fname)){
            log.error('文件(%s)不存在!', fname)
            process.exit(0)
        }else{
            const stm = fs.createReadStream(fname, {encoding: 'utf8'})
            var body = ""
            stm.on('data', (tmp)=>{body+=tmp})
            stm.on('end', ()=>{
                const raws = new Raws([])
                const lines = body.split('\n')
                for(var i=0; i<lines.length; i++){
                    const ary = lines[i].split(' ')
                    if(ary.length < 6 || '>'!=ary[3])
                        continue
                    const buf = Buffer.from(ary[5], 'hex')
                    raws.add(jt808.decode(buf))
                }

                if(raws.cnt>0){
                    this.rawsAry.push(raws)
                    log.info('%s 加载到(%d)条原始数据', fname, raws.cnt)
                }else{
                    log.info('%s 加载的文件没有原始数据', fname)
                }
                callback()
            })
        }
    }

    // 加载一个目录下是原始数据
    this.loadPath = function(dir, callback){
        if(!fs.existsSync(dir)){
            log.error('目录(%s)不存在!', dir)
            process.exit(0)
        }else{
            log.info('加载目录(%s)', dir)
            const path = require('path')
            const list = fs.readdirSync(dir)
            if(list.length==0){
                log.error('指定的路径下没有原始文件 ', dir)
                process.exit(0)
            }

            this.fnames = []
            for(var i=0; i<list.length; i++){
                const tmp = dir + path.sep + list[i]
                this.fnames.push(tmp)
            }

            // 递归加载全部文件
            function loadMore(self){
                //log.info('loadMore.', self.fnames)
                if(self.fnames.length>0){
                    const name = self.fnames.shift()
                    self.loadFile(name, ()=>{
                        loadMore(self)
                    })
                }else{
                    callback()
                }
            }

            loadMore(this)
        }
    }
}

module.exports = Srcs
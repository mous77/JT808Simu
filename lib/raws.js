

const log = require('log4js').getLogger('raws')

/**
 * 待播放的数据，可以支持多个
 */
function Raws(ary){
    this.rev = false // false 时正向播放， true 时反向回放
    this.idx = 0
    this.cnt = ary.length
    this.ary = ary

    // 初始化时，从文件加载原始数据后，调用该方法添加一条数据
    this.add = function(buf){
        this.cnt++
        this.ary.push(buf)
    }

    /**
     * 每个车拷贝一份
     */
    this.copy = function(){
        return new Raws(this.ary)
    }

    /**
     * 取下一条待播放的原始数据，播放到末尾就反过来放
     */
    this.next = function(){
        var res = Buffer.from(this.ary[this.idx])

        //log.info('play ', res.toString('hex'))

        if(this.cnt > 1){
            if(this.rev){
                // 反向回放，9 8 7 6 5 4 3 2 1 0
                if(--this.idx <0){
                    this.rev = false
                    this.idx++
                    log.info('改为正向播放 ', this.idx)
                }
            }else{
                // 正向播放，0 1 2 3 4 5 6 7 8 9
                if(++this.idx == this.cnt){
                    this.rev = true
                    this.idx--
                    log.info('改为反向播放 ', this.idx)
                }
            }
        }

        return res
    }
}

module.exports = Raws
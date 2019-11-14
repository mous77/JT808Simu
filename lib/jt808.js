
function JT808(){
    
    // JT 808 反转义
    this.decode = function(src){
        const s_len = src.length
        var less = 0
        for(var i=1; i<s_len-1; i++){
            if(0x7D==src[i])
                less++
        }

        if(0==less){
            return src
        }

        var dst = Buffer.alloc(s_len-less)
        
        dst[0] = 0x7E
        for(var i=1,k=1; i<s_len-1; i++){
            if(0x7D==src[i]){
                switch(src[i+1]){
                    case 0x01:
                        dst[k++] = 0x7D
                        break
                    case 0x02:
                        dst[k++] = 0x7E 
                        break
                }
                i++
            }else{
                dst[k++] = src[i]
            }
        }
        dst[dst.length-1] = 0x7E

        return dst
    }
    
    // JT-808 转义 
    this.encode = function(src){
        const s_len = src.length

        // 数据中间部分有标识才需要转义
        var more = 0
        for(var i=1; i<s_len-1; i++){
            if(0x7D==src[i] || 0x7E==src[i])
                more++
        }

        if(0==more){
            return src
        }

        var dst = Buffer.alloc(s_len + more)
        
        // 除开首尾两个字节之外的其他数据全部处理
        dst[0] = 0x7E
        for(var i=1,k=1; i<s_len-1; i++){
            switch(src[i]){
                case 0x7D:  // ==> 7D 01
                    dst[k++]=0x7D
                    dst[k++]=0x01
                    break
                case 0x7E:  // ==> 7D 02
                    dst[k++]=0x7D
                    dst[k++]=0x02
                    break
                default:
                    dst[k++]=src[i]
            }
        }
        dst[dst.length-1] = 0x7E

        return dst
    }

    function bcd(v){
        return (v / 10) << 4 | (v % 10)
    }

    /**
     * 将当前时间，分解为 年 月 日 时 分 秒
     */
    this.getTime = function(){
        const t = new Date()
        return Buffer.from([
            bcd(t.getFullYear()-2000), 
            bcd(t.getMonth()+1), 
            bcd(t.getDate()), 
            bcd(t.getHours()), 
            bcd(t.getMinutes()), 
            bcd(t.getSeconds())
        ])
    }

    this.getCrc = function(buf,len){
        var crc = buf[1]
        for(var i=2;i<len-2;i++){
            crc ^= (buf[i] & 0xFF)
        }
        return crc
    }
   
    /**
     * 
     * 将一个808包，替换掉通信号码，重新计算校验，再做转义
     * 7E0200003C0133012428001DDF00000000000C00C3014AAA4406880880000402C601161909012249530104001538DF02020000030200002504000000002B0400000000300104310110BC7E
     * 0                      1                      2                   3                         4
     * 0  1 2  3 4  5 6 7 8 9 0  1 2  3 4  5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4  5  6  7  8  9  0
     * 7E 0200 003C 013301242800 1DDF 0000 0000000C00C3014AAA4406880880000402C60116 19-09-01 22:49:53 0104001538DF02020000030200002504000000002B0400000000300104310110 BC 7E
     * 
     */
    this.makeRaw = function(time,code,buf,cmdq){
         // 修改通信号码
         for(var i=0; i<6; i++){
             buf[i+5] = code[i]
         }

         buf[11] = (cmdq >> 8) & 0xFF
         buf[12] = cmdq & 0xFF
 
         // 修改 年月日时分秒
         for(var i=0; i<6; i++){
             buf[i+35] = time[i]
         }
         
         // 重新计算校验
         const len = buf.length
         buf[len-2] = this.getCrc(buf,len)
 
         // 数据转义
         return this.encode(buf)
    }
}

module.exports = JT808
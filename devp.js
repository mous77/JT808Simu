/**
 * 
 * JT-808 模拟终端程序，用于压力测试
 * 
 * 2019-10-29， by mous
 *  拆分为多个文件进行编码，方便修改与维护
 * 
 */

const conf = {
    addr: '',           // 从这个地址上发起连接，在有多个IP的机器上，每个IP都可以发出 6万多个客户端连接请求
    host: '127.0.0.1',  // 服务器地址
    port: 6000,         // 服务器端口
    keys: 13800138000,  // 通信号码-开始
    nums: 1,            // 模拟的终端数量
    raws: './raws',     // 模拟的数据源所在目录
    freq: 10,           // 多少秒发一个数据包
    echo: false,        // 显示数据
}

// todo 
// 在这里修改启动参数
conf.raws = './raws'

const Facade = require('./lib/facade')

new Facade(conf)
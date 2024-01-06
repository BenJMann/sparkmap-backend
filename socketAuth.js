module.exports = function(io) {
    io.use(async function(socket, next){
        try {
            socket.tokenkey =  process.env.TOKENKEY
            next();
            
        } catch (e) {               
            console.log(''+e);
            return next(new Error(e.toString()));
        }
        });

  }
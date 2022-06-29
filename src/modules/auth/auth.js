const Router = require('koa-router');
const bodyParser = require('koa-bodyparser');
const {compareSync} = require('bcryptjs')
const userService = require('../../services/user');
const jwt = require('jsonwebtoken')
const {v4: uuidv4} = require('uuid')
const refreshTokenService = require('../../services/refreshToken')
const config = require('../../config')
const jwtMiddleware = require("koa-jwt");


const router = new Router();

const  issueTokenPair = async (userId) => {
  // генерируем новый токен
  const newRefreshToken = uuidv4();
  // добавляем токен в БД
  await refreshTokenService.add({
    id: userId,
    token: newRefreshToken,
  });
  return {
    token: jwt.sign({id: userId}, config.secret),
    refreshToken: newRefreshToken
  }
}

router.post('/login',bodyParser(), async ctx => {
  const { login, password } = ctx.request.body;
  const user = await userService.find({login})

  if(!user || !compareSync(password, user.password)) {
    const error = new Error();
    error.status = 403;
    throw error;
  }
  // генерируем новый токен
  const newRefreshToken = uuidv4();
  // добавляем токен в БД
  await refreshTokenService.add({
    id: user.id,
    token: newRefreshToken,
  });

  ctx.body = await issueTokenPair(user.id)
});

router.post('/refresh',bodyParser(), async ctx => {
  const { refreshToken } = ctx.request.body;
  const dbToken = await refreshTokenService.find({token: refreshToken});
  if(!dbToken) {
    return;
  }
  await refreshTokenService.remove({
    token: refreshToken
  })
  ctx.body = await issueTokenPair(dbToken.id);
});

router.post('/logout', jwtMiddleware({secret: config.secret}), async ctx => {
  const {id} = ctx.state.user;

  await refreshTokenService.remove({id})

  ctx.body = {success: true}
})

module.exports = router;

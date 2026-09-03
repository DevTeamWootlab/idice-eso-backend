declare module 'compression' {
  import { RequestHandler } from 'express';

  const compression: () => RequestHandler;
  export default compression;
}

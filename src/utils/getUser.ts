import express from 'express';
import { JwtPayload } from '../config/jwt.js';

export const getUser = (request: express.Request): JwtPayload =>
  (request as express.Request & { user: JwtPayload }).user;

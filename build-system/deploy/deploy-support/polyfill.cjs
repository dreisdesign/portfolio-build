const { ReadableStream, WritableStream, TransformStream } = require('web-streams-polyfill');

global.ReadableStream = ReadableStream;
global.WritableStream = WritableStream;
global.TransformStream = TransformStream;

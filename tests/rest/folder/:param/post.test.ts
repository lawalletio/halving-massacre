import { ExtendedRequest } from '@lawallet/module';
import post from '@rest/folder/:param/post';
import type { Response } from 'express';

describe('POST handler', () => {
  it('Should handle requests', () => {
    const mockReq = {} as ExtendedRequest;
    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn(),
    } as unknown as Response;

    post(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(mockRes.json).toHaveBeenCalled();
    expect(mockRes.send).toHaveBeenCalled();
  });
});

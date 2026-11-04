import { Image } from 'react-native';
import TextRecognition from '@react-native-ml-kit/text-recognition';
import { recognizeMenuLines } from '@/lib/scan/ocr';
jest.mock('@react-native-ml-kit/text-recognition', () => ({ __esModule: true,
  default: { recognize: jest.fn() }, TextRecognitionScript: { KOREAN: 'Korean' } }));
it('reuses native Korean OCR and normalization without logging text, URI or boxes', async () => {
  const log = jest.spyOn(console, 'log').mockImplementation(() => {});
  const size = jest.spyOn(Image, 'getSize').mockImplementation((_uri, success) => { success(200, 100); return Promise.resolve({ width: 200, height: 100 }); });
  (TextRecognition.recognize as jest.Mock).mockResolvedValue({ text: 'private text', blocks: [{ lines: [
    { text: 'private text', frame: { left: 20, top: 10, width: 100, height: 20 } },
  ] }] });
  const geometry = jest.fn();
  const lines = await recognizeMenuLines('file:///private-photo.png', 200, 100, { diagnostics: false, onGeometry: geometry });
  expect(TextRecognition.recognize).toHaveBeenCalledWith('file:///private-photo.png', 'Korean');
  expect(lines).toEqual([{ text: 'private text', box: { x: .1, y: .1, width: .5, height: .2 } }]);
  expect(log).not.toHaveBeenCalled();
  expect(geometry).toHaveBeenCalledWith(expect.objectContaining({ pxW: 200, pxH: 100, basis: 'measured' }));
  await recognizeMenuLines('file:///normal.png', 200, 100);
  expect(log).toHaveBeenCalled(); // Existing consumers retain diagnostics.
  size.mockRestore(); log.mockRestore();
});

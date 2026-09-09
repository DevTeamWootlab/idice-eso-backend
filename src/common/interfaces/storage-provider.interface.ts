export interface IStorageProvider {
  uploadFile(
    buffer: Buffer,
    folderKey: string,
    fileName: string,
  ): Promise<string>;
  readFile(storageKey: string): Promise<Buffer>;
  deleteFile(storageKey: string): Promise<void>;
}

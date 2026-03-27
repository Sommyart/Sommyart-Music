declare module "jsmediatags" {
  interface PictureTag {
    data: number[];
    format: string;
    type: string;
    description: string;
  }

  interface Tags {
    title?: string;
    artist?: string;
    album?: string;
    year?: string;
    picture?: PictureTag;
    [key: string]: unknown;
  }

  interface TagResult {
    type: string;
    tags: Tags;
  }

  interface Callbacks {
    onSuccess: (tag: TagResult) => void;
    onError: (error: { type: string; info: string }) => void;
  }

  function read(url: string, callbacks: Callbacks): void;

  export default { read };
}

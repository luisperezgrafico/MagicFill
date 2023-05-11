declare module 'form-data' {
  class FormData {
    append(key: string, value: any): void;
  }

  export = FormData;
}

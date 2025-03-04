export class Tools {
  static importAll(r: __WebpackModuleApi.RequireContext): { default: string }[] {
    return r.keys().map(key => r(key))
  }
}

/**
 * Metro resolves media files to an asset id, so importing one yields a number
 * that expo-audio and Image take directly. Declaring it here keeps the import
 * typed instead of falling back to require().
 */
declare module '*.wav' {
  const asset: number;
  export default asset;
}

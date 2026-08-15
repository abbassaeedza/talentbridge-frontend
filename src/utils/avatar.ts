const DEFAULT_AVATARS = [
  'https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/purple.jpg',
  'https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/red.jpg',
  'https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/blue.jpg',
] as const;

export function defaultAvatarUrl(seed: string) {
  const index = [...seed].reduce((sum, character) => sum + character.codePointAt(0)!, 0) % DEFAULT_AVATARS.length;
  return DEFAULT_AVATARS[index];
}

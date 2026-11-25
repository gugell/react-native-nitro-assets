'use strict';

const PACK_ID = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;
const BA_POLICIES = ['essential', 'prefetch', 'on-demand'];
const ODR_POLICIES = ['initial-install', 'prefetch', 'on-demand'];
const PAD_DELIVERY = ['install-time', 'fast-follow', 'on-demand'];
const NAME = 'react-native-nitro-assets';

/** Play Asset Delivery pack names allow letters, digits and `_` only: `intent-model` → `intent_model`. */
function androidPackName(packId) {
  return packId.replace(/-/g, '_');
}

function fail(message) {
  throw new Error(`${NAME}: ${message}`);
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** `undefined`/`false` → disabled; an object → enabled. */
function section(value, where) {
  if (value === undefined || value === false || value === null) return undefined;
  if (value === true) return {};
  if (!isObject(value)) fail(`${where} must be an object or false`);
  return value;
}

function policies(map, allowed, where, sources) {
  if (map === undefined) return {};
  if (!isObject(map)) fail(`${where}.packs must map pack ids to one of ${allowed.join(', ')}`);
  const result = {};
  for (const [packId, policy] of Object.entries(map)) {
    if (!PACK_ID.test(packId)) fail(`${where}.packs: invalid pack id "${packId}"`);
    if (!allowed.includes(policy))
      fail(`${where}.packs["${packId}"] must be one of ${allowed.join(', ')} (got ${JSON.stringify(policy)})`);
    if (sources && !sources[packId])
      fail(`${where}.packs["${packId}"] has no source: add packs["${packId}"].path`);
    result[packId] = policy;
  }
  return result;
}

/**
 * Checks the plugin props and returns them normalized. Disabled backends come back `undefined`, so
 * the plugin emits nothing for them.
 *
 * @param {unknown} props
 * @param {{ bundleIdentifier?: string }} ios
 */
function resolveProps(props, ios = {}) {
  const input = isObject(props) ? props : {};
  const packs = {};
  if (input.packs !== undefined) {
    if (!isObject(input.packs)) fail('packs must map pack ids to { path }');
    for (const [packId, source] of Object.entries(input.packs)) {
      if (!PACK_ID.test(packId))
        fail(`packs: invalid pack id "${packId}" (a letter, then letters, digits, "-" or "_", at most 64)`);
      const path = typeof source === 'string' ? source : isObject(source) ? source.path : undefined;
      if (typeof path !== 'string' || path.length === 0) fail(`packs["${packId}"].path must be a directory`);
      packs[packId] = { path };
    }
  }

  const inputIos = isObject(input.ios) ? input.ios : {};
  const ba = section(inputIos.backgroundAssets, 'ios.backgroundAssets');
  let backgroundAssets;
  if (ba) {
    const appGroupId =
      ba.appGroupId || (ios.bundleIdentifier ? `group.${ios.bundleIdentifier}` : undefined);
    if (!appGroupId || !/^group\.[A-Za-z0-9.-]+$/.test(appGroupId))
      fail('ios.backgroundAssets.appGroupId must be "group.<id>" (or set ios.bundleIdentifier for the default)');
    backgroundAssets = {
      appGroupId,
      // Policies feed `nitro-assets package`; a pack without a source can still be declared here
      // when its files are built elsewhere.
      packs: policies(ba.packs, BA_POLICIES, 'ios.backgroundAssets'),
    };
  }

  const odrInput = section(inputIos.odr, 'ios.odr');
  let odr;
  if (odrInput) {
    odr = { packs: policies(odrInput.packs, ODR_POLICIES, 'ios.odr', packs) };
    if (Object.keys(odr.packs).length === 0) fail('ios.odr.packs is empty: name the packs to tag, or set ios.odr to false');
  }

  const inputAndroid = isObject(input.android) ? input.android : {};
  const padInput = section(inputAndroid.playAssetDelivery, 'android.playAssetDelivery');
  let playAssetDelivery;
  if (padInput) {
    playAssetDelivery = {
      packs: policies(padInput.packs, PAD_DELIVERY, 'android.playAssetDelivery', packs),
    };
    const names = new Map();
    for (const packId of Object.keys(playAssetDelivery.packs)) {
      const name = androidPackName(packId);
      if (names.has(name))
        fail(`android.playAssetDelivery: "${names.get(name)}" and "${packId}" both become the Android pack "${name}"`);
      names.set(name, packId);
    }
    if (names.size === 0) fail('android.playAssetDelivery.packs is empty: name the packs, or set it to false');
  }

  return { packs, ios: { backgroundAssets, odr }, android: { playAssetDelivery } };
}

module.exports = { resolveProps, androidPackName, PACK_ID, BA_POLICIES, ODR_POLICIES, PAD_DELIVERY };

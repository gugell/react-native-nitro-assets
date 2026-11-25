'use strict';

const fs = require('fs');
const path = require('path');

const APP_GROUPS = 'com.apple.security.application-groups';
const ODR_FLAG = 'NitroAssetsUsesOnDemandResources';
/** Generated copies of ODR pack folders, inside the generated ios/ directory. */
const ODR_DIR = 'NitroAssetsPacks';

function union(existing, values) {
  const list = Array.isArray(existing) ? [...existing] : [];
  for (const value of values) if (!list.includes(value)) list.push(value);
  return list;
}

/**
 * Info.plist keys for Apple-hosted, managed asset packs (WWDC25 session 325, "Downloading
 * Apple-hosted asset packs"). Apple says to omit every other `BA*` key for Apple hosting.
 */
function applyBackgroundAssetsInfoPlist(infoPlist, { appGroupId }) {
  const result = { ...infoPlist, BAAppGroupID: appGroupId, BAHasManagedAssetPacks: true, BAUsesAppleHosting: true };
  for (const key of ['BAManifestURL', 'BAInitialDownloadRestrictions', 'BAEssentialMaxInstallSize', 'BAMaxInstallSize'])
    delete result[key];
  return result;
}

/** The app group the app and its downloader extension share, merged into existing groups. */
function applyAppGroupEntitlement(entitlements, { appGroupId }) {
  return { ...entitlements, [APP_GROUPS]: union(entitlements[APP_GROUPS], [appGroupId]) };
}

function applyOnDemandResourcesInfoPlist(infoPlist) {
  return { ...infoPlist, [ODR_FLAG]: true };
}

function copyDirectory(from, to) {
  fs.rmSync(to, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.cpSync(from, to, { recursive: true, dereference: true, filter: (source) => path.basename(source) !== '.DS_Store' });
}

/**
 * Copies each ODR pack's files into `ios/NitroAssetsPacks/<packId>/`, so the folder's name is the
 * pack id whatever the source directory is called.
 */
function copyOnDemandResourcePacks({ projectRoot, platformProjectRoot, packs, odr }) {
  for (const packId of Object.keys(odr.packs)) {
    const source = path.resolve(projectRoot, packs[packId].path);
    if (!fs.existsSync(source) || !fs.statSync(source).isDirectory())
      throw new Error(`react-native-nitro-assets: packs["${packId}"].path (${source}) is not a directory`);
    copyDirectory(source, path.join(platformProjectRoot, ODR_DIR, packId));
  }
}

const quote = (value) => `"${value}"`;
const unquote = (value) => (typeof value === 'string' ? value.replace(/^"(.*)"$/, '$1') : value);

/**
 * Tags each pack folder for On-Demand Resources in the Xcode project: a folder reference named
 * `<packId>` in the `NitroAssetsPacks` group, in the app's Resources phase with
 * `ASSET_TAGS = (<packId>)`, the tag in `KnownAssetTags`, and the initial-install / prefetch
 * build settings. Debug builds embed the packs in the app so they work without the App Store.
 *
 * @param project an `xcode` project (`withXcodeProject`'s `modResults`)
 */
function applyOnDemandResourcesProject(project, { odr }) {
  const objects = project.hash.project.objects;
  const target = project.getFirstTarget();
  if (!target) throw new Error('react-native-nitro-assets: no app target in the Xcode project');
  const nativeTarget = target.firstTarget;

  // Group "NitroAssetsPacks" (path relative to ios/), under the main group.
  let groupKey = Object.keys(objects.PBXGroup).find(
    (key) => !key.endsWith('_comment') && unquote(objects.PBXGroup[key].name) === ODR_DIR,
  );
  if (!groupKey) {
    groupKey = project.generateUuid();
    objects.PBXGroup[groupKey] = { isa: 'PBXGroup', children: [], name: ODR_DIR, path: ODR_DIR, sourceTree: quote('<group>') };
    objects.PBXGroup[`${groupKey}_comment`] = ODR_DIR;
    const mainGroupKey = project.getFirstProject().firstProject.mainGroup;
    objects.PBXGroup[mainGroupKey].children.push({ value: groupKey, comment: ODR_DIR });
  }
  const group = objects.PBXGroup[groupKey];

  const resourcesPhaseKey = nativeTarget.buildPhases
    .map((phase) => phase.value)
    .find((key) => objects.PBXResourcesBuildPhase && objects.PBXResourcesBuildPhase[key]);
  if (!resourcesPhaseKey) throw new Error('react-native-nitro-assets: the app target has no Resources phase');
  const resourcesPhase = objects.PBXResourcesBuildPhase[resourcesPhaseKey];

  for (const packId of Object.keys(odr.packs)) {
    const existing = group.children.find((child) => unquote(child.comment) === packId);
    if (existing) continue;
    const fileRefKey = project.generateUuid();
    objects.PBXFileReference[fileRefKey] = {
      isa: 'PBXFileReference',
      lastKnownFileType: 'folder',
      name: quote(packId),
      path: quote(packId),
      sourceTree: quote('<group>'),
    };
    objects.PBXFileReference[`${fileRefKey}_comment`] = packId;
    group.children.push({ value: fileRefKey, comment: packId });

    const buildFileKey = project.generateUuid();
    objects.PBXBuildFile[buildFileKey] = {
      isa: 'PBXBuildFile',
      fileRef: fileRefKey,
      fileRef_comment: packId,
      settings: { ASSET_TAGS: [quote(packId)] },
    };
    objects.PBXBuildFile[`${buildFileKey}_comment`] = `${packId} in Resources`;
    resourcesPhase.files.push({ value: buildFileKey, comment: `${packId} in Resources` });
  }

  const projectObject = project.getFirstProject().firstProject;
  projectObject.attributes = projectObject.attributes || {};
  const known = (projectObject.attributes.KnownAssetTags || []).map(unquote);
  projectObject.attributes.KnownAssetTags = union(known, Object.keys(odr.packs)).map(quote);

  const tagsWith = (policy) => Object.keys(odr.packs).filter((packId) => odr.packs[packId] === policy);
  const configurations = project.pbxXCConfigurationList()[nativeTarget.buildConfigurationList].buildConfigurations;
  for (const { value } of configurations) {
    const configuration = project.pbxXCBuildConfigurationSection()[value];
    const settings = configuration.buildSettings;
    settings.ENABLE_ON_DEMAND_RESOURCES = 'YES';
    const initial = tagsWith('initial-install');
    const prefetch = tagsWith('prefetch');
    if (initial.length) settings.ON_DEMAND_RESOURCES_INITIAL_INSTALL_TAGS = quote(initial.join(' '));
    else delete settings.ON_DEMAND_RESOURCES_INITIAL_INSTALL_TAGS;
    if (prefetch.length) settings.ON_DEMAND_RESOURCES_PREFETCH_ORDER = quote(prefetch.join(' '));
    else delete settings.ON_DEMAND_RESOURCES_PREFETCH_ORDER;
    // Development builds are not served by the App Store: keep the packs inside the app bundle.
    if (unquote(configuration.name) === 'Debug') settings.EMBED_ASSET_PACKS_IN_PRODUCT_BUNDLE = 'YES';
  }
  return project;
}

module.exports = {
  APP_GROUPS,
  ODR_DIR,
  ODR_FLAG,
  applyAppGroupEntitlement,
  applyBackgroundAssetsInfoPlist,
  applyOnDemandResourcesInfoPlist,
  applyOnDemandResourcesProject,
  copyOnDemandResourcePacks,
};

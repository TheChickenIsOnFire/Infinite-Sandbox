import * as THREE from './three.module.min.js';

/**
 * Merge an array of BufferGeometries into one.
 * @param {THREE.BufferGeometry[]} geometries 
 * @param {boolean} useGroups 
 * @returns {THREE.BufferGeometry}
 */
export function mergeBufferGeometries(geometries, useGroups = false) {
  const isIndexed = geometries[0].index !== null;

  const attributesUsed = new Set(Object.keys(geometries[0].attributes));
  const morphAttributesUsed = new Set(Object.keys(geometries[0].morphAttributes));

  const attributes = {};
  const morphAttributes = {};

  let offset = 0;

  const mergedGeometry = new THREE.BufferGeometry();

  for (let i = 0; i < geometries.length; ++i) {
    const geometry = geometries[i];

    // ensure consistent index
    if (isIndexed !== (geometry.index !== null)) {
      console.error('mergeBufferGeometries() failed: inconsistent index presence.');
      return null;
    }

    // gather attributes, check compatibility
    for (const name in geometry.attributes) {
      if (!attributesUsed.has(name)) {
        console.error('mergeBufferGeometries() failed: inconsistent attributes.');
        return null;
      }

      if (attributes[name] === undefined) attributes[name] = [];
      attributes[name].push(geometry.attributes[name]);
    }

    // gather morph attributes
    for (const name in geometry.morphAttributes) {
      if (!morphAttributesUsed.has(name)) {
        console.error('mergeBufferGeometries() failed: inconsistent morph attributes.');
        return null;
      }

      if (morphAttributes[name] === undefined) morphAttributes[name] = [];
      morphAttributes[name].push(geometry.morphAttributes[name]);
    }

    if (useGroups) {
      let count;
      if (isIndexed) {
        count = geometry.index.count;
      } else if (geometry.attributes.position !== undefined) {
        count = geometry.attributes.position.count;
      } else {
        console.error('mergeBufferGeometries() failed: missing position attribute.');
        return null;
      }

      mergedGeometry.addGroup(offset, count, i);
      offset += count;
    }
  }

  // merge indices
  if (isIndexed) {
    let indexOffset = 0;
    const mergedIndex = [];

    for (let i = 0; i < geometries.length; ++i) {
      const index = geometries[i].index;
      for (let j = 0; j < index.count; ++j) {
        mergedIndex.push(index.getX(j) + indexOffset);
      }
      indexOffset += geometries[i].attributes.position.count;
    }

    mergedGeometry.setIndex(mergedIndex);
  }

  // merge attributes
  for (const name of attributesUsed) {
    const mergedAttribute = THREE.BufferAttributeUtils
      ? THREE.BufferAttributeUtils.mergeBufferAttributes(attributes[name])
      : mergeBufferAttributes(attributes[name]);
    if (!mergedAttribute) {
      console.error('mergeBufferGeometries() failed while merging attribute ' + name);
      return null;
    }
    mergedGeometry.setAttribute(name, mergedAttribute);
  }

  return mergedGeometry;
}

/**
 * Merge an array of BufferAttributes into one.
 * @param {THREE.BufferAttribute[]} attributes 
 * @returns {THREE.BufferAttribute}
 */
function mergeBufferAttributes(attributes) {
  let arrayLength = 0;
  const itemSize = attributes[0].itemSize;
  const normalized = attributes[0].normalized;

  for (let i = 0; i < attributes.length; ++i) {
    arrayLength += attributes[i].count * itemSize;
  }

  const array = new attributes[0].array.constructor(arrayLength);

  let offset = 0;

  for (let i = 0; i < attributes.length; ++i) {
    array.set(attributes[i].array, offset);
    offset += attributes[i].array.length;
  }

  return new THREE.BufferAttribute(array, itemSize, normalized);
}

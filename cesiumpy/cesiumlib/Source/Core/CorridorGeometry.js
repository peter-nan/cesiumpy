/*global define*/
define([
        './BoundingSphere',
        './Cartesian3',
        './ComponentDatatype',
        './CornerType',
        './CorridorGeometryLibrary',
        './defaultValue',
        './defined',
        './DeveloperError',
        './Ellipsoid',
        './Geometry',
        './GeometryAttribute',
        './GeometryAttributes',
        './IndexDatatype',
        './Math',
        './PolylinePipeline',
        './PrimitiveType',
        './VertexFormat'
    ], function(
        BoundingSphere,
        Cartesian3,
        ComponentDatatype,
        CornerType,
        CorridorGeometryLibrary,
        defaultValue,
        defined,
        DeveloperError,
        Ellipsoid,
        Geometry,
        GeometryAttribute,
        GeometryAttributes,
        IndexDatatype,
        CesiumMath,
        PolylinePipeline,
        PrimitiveType,
        VertexFormat) {
    "use strict";

    var cartesian1 = new Cartesian3();
    var cartesian2 = new Cartesian3();
    var cartesian3 = new Cartesian3();
    var cartesian4 = new Cartesian3();
    var cartesian5 = new Cartesian3();
    var cartesian6 = new Cartesian3();

    var scratch1 = new Cartesian3();
    var scratch2 = new Cartesian3();

    function addNormals(attr, normal, left, front, back, vertexFormat) {
        var normals = attr.normals;
        var tangents = attr.tangents;
        var binormals = attr.binormals;
        var forward = Cartesian3.normalize(Cartesian3.cross(left, normal, scratch1), scratch1);
        if (vertexFormat.normal) {
            CorridorGeometryLibrary.addAttribute(normals, normal, front, back);
        }
        if (vertexFormat.binormal) {
            CorridorGeometryLibrary.addAttribute(binormals, left, front, back);
        }
        if (vertexFormat.tangent) {
            CorridorGeometryLibrary.addAttribute(tangents, forward, front, back);
        }
    }

    function combine(computedPositions, vertexFormat, ellipsoid) {
        var positions = computedPositions.positions;
        var corners = computedPositions.corners;
        var endPositions = computedPositions.endPositions;
        var computedLefts = computedPositions.lefts;
        var computedNormals = computedPositions.normals;
        var attributes = new GeometryAttributes();
        var corner;
        var leftCount = 0;
        var rightCount = 0;
        var i;
        var indicesLength = 0;
        var length;
        for (i = 0; i < positions.length; i += 2) {
            length = positions[i].length - 3;
            leftCount += length; //subtracting 3 to account for duplicate points at corners
            indicesLength += length*2;
            rightCount += positions[i + 1].length - 3;
        }
        leftCount += 3; //add back count for end positions
        rightCount += 3;
        for (i = 0; i < corners.length; i++) {
            corner = corners[i];
            var leftSide = corners[i].leftPositions;
            if (defined(leftSide)) {
                length = leftSide.length;
                leftCount += length;
                indicesLength += length;
            } else {
                length = corners[i].rightPositions.length;
                rightCount += length;
                indicesLength += length;
            }
        }

        var addEndPositions = defined(endPositions);
        var endPositionLength;
        if (addEndPositions) {
            endPositionLength = endPositions[0].length - 3;
            leftCount += endPositionLength;
            rightCount += endPositionLength;
            endPositionLength /= 3;
            indicesLength += endPositionLength * 6;
        }
        var size = leftCount + rightCount;
        var finalPositions = new Float64Array(size);
        var normals = (vertexFormat.normal) ? new Float32Array(size) : undefined;
        var tangents = (vertexFormat.tangent) ? new Float32Array(size) : undefined;
        var binormals = (vertexFormat.binormal) ? new Float32Array(size) : undefined;
        var attr = {
            normals : normals,
            tangents : tangents,
            binormals : binormals
        };
        var front = 0;
        var back = size - 1;
        var UL, LL, UR, LR;
        var normal = cartesian1;
        var left = cartesian2;
        var rightPos, leftPos;
        var halfLength = endPositionLength / 2;

        var indices = IndexDatatype.createTypedArray(size / 3, indicesLength);
        var index = 0;
        if (addEndPositions) { // add rounded end
            leftPos = cartesian3;
            rightPos = cartesian4;
            var firstEndPositions = endPositions[0];
            normal = Cartesian3.fromArray(computedNormals, 0, normal);
            left = Cartesian3.fromArray(computedLefts, 0, left);
            for (i = 0; i < halfLength; i++) {
                leftPos = Cartesian3.fromArray(firstEndPositions, (halfLength - 1 - i) * 3, leftPos);
                rightPos = Cartesian3.fromArray(firstEndPositions, (halfLength + i) * 3, rightPos);
                CorridorGeometryLibrary.addAttribute(finalPositions, rightPos, front);
                CorridorGeometryLibrary.addAttribute(finalPositions, leftPos, undefined, back);
                addNormals(attr, normal, left, front, back, vertexFormat);

                LL = front / 3;
                LR = LL + 1;
                UL = (back - 2) / 3;
                UR = UL - 1;
                indices[index++] = UL;
                indices[index++] = LL;
                indices[index++] = UR;
                indices[index++] = UR;
                indices[index++] = LL;
                indices[index++] = LR;

                front += 3;
                back -= 3;
            }
        }

        var posIndex = 0;
        var compIndex = 0;
        var rightEdge = positions[posIndex++]; //add first two edges
        var leftEdge = positions[posIndex++];
        finalPositions.set(rightEdge, front);
        finalPositions.set(leftEdge, back - leftEdge.length + 1);

        left = Cartesian3.fromArray(computedLefts, compIndex, left);
        var rightNormal;
        var leftNormal;
        length = leftEdge.length - 3;
        for (i = 0; i < length; i += 3) {
            rightNormal = ellipsoid.geodeticSurfaceNormal(Cartesian3.fromArray(rightEdge, i, scratch1), scratch1);
            leftNormal = ellipsoid.geodeticSurfaceNormal(Cartesian3.fromArray(leftEdge, length - i, scratch2), scratch2);
            normal = Cartesian3.normalize(Cartesian3.add(rightNormal, leftNormal, normal), normal);
            addNormals(attr, normal, left, front, back, vertexFormat);

            LL = front / 3;
            LR = LL + 1;
            UL = (back - 2) / 3;
            UR = UL - 1;
            indices[index++] = UL;
            indices[index++] = LL;
            indices[index++] = UR;
            indices[index++] = UR;
            indices[index++] = LL;
            indices[index++] = LR;

            front += 3;
            back -= 3;
        }

        rightNormal = ellipsoid.geodeticSurfaceNormal(Cartesian3.fromArray(rightEdge, length, scratch1), scratch1);
        leftNormal = ellipsoid.geodeticSurfaceNormal(Cartesian3.fromArray(leftEdge, length, scratch2), scratch2);
        normal = Cartesian3.normalize(Cartesian3.add(rightNormal, leftNormal, normal), normal);
        compIndex += 3;
        for (i = 0; i < corners.length; i++) {
            var j;
            corner = corners[i];
            var l = corner.leftPositions;
            var r = corner.rightPositions;
            var pivot;
            var start;
            var outsidePoint = cartesian6;
            var previousPoint = cartesian3;
            var nextPoint = cartesian4;
            normal = Cartesian3.fromArray(computedNormals, compIndex, normal);
            if (defined(l)) {
                addNormals(attr, normal, left, undefined, back, vertexFormat);
                back -= 3;
                pivot = LR;
                start = UR;
                for (j = 0; j < l.length / 3; j++) {
                    outsidePoint = Cartesian3.fromArray(l, j * 3, outsidePoint);
                    indices[index++] = pivot;
                    indices[index++] = start - j - 1;
                    indices[index++] = start - j;
                    CorridorGeometryLibrary.addAttribute(finalPositions, outsidePoint, undefined, back);
                    previousPoint = Cartesian3.fromArray(finalPositions, (start - j - 1) * 3, previousPoint);
                    nextPoint = Cartesian3.fromArray(finalPositions, pivot * 3, nextPoint);
                    left = Cartesian3.normalize(Cartesian3.subtract(previousPoint, nextPoint, left), left);
                    addNormals(attr, normal, left, undefined, back, vertexFormat);
                    back -= 3;
                }
                outsidePoint = Cartesian3.fromArray(finalPositions, pivot * 3, outsidePoint);
                previousPoint = Cartesian3.subtract(Cartesian3.fromArray(finalPositions, (start) * 3, previousPoint), outsidePoint, previousPoint);
                nextPoint = Cartesian3.subtract(Cartesian3.fromArray(finalPositions, (start - j) * 3, nextPoint), outsidePoint, nextPoint);
                left = Cartesian3.normalize(Cartesian3.add(previousPoint, nextPoint, left), left);
                addNormals(attr, normal, left, front, undefined, vertexFormat);
                front += 3;
            } else {
                addNormals(attr, normal, left, front, undefined, vertexFormat);
                front += 3;
                pivot = UR;
                start = LR;
                for (j = 0; j < r.length / 3; j++) {
                    outsidePoint = Cartesian3.fromArray(r, j * 3, outsidePoint);
                    indices[index++] = pivot;
                    indices[index++] = start + j;
                    indices[index++] = start + j + 1;
                    CorridorGeometryLibrary.addAttribute(finalPositions, outsidePoint, front);
                    previousPoint = Cartesian3.fromArray(finalPositions, pivot * 3, previousPoint);
                    nextPoint = Cartesian3.fromArray(finalPositions, (start + j) * 3, nextPoint);
                    left = Cartesian3.normalize(Cartesian3.subtract(previousPoint, nextPoint, left), left);
                    addNormals(attr, normal, left, front, undefined, vertexFormat);
                    front += 3;
                }
                outsidePoint = Cartesian3.fromArray(finalPositions, pivot * 3, outsidePoint);
                previousPoint = Cartesian3.subtract(Cartesian3.fromArray(finalPositions, (start + j) * 3, previousPoint), outsidePoint, previousPoint);
                nextPoint = Cartesian3.subtract(Cartesian3.fromArray(finalPositions, start * 3, nextPoint), outsidePoint, nextPoint);
                left = Cartesian3.normalize(Cartesian3.negate(Cartesian3.add(nextPoint, previousPoint, left), left), left);
                addNormals(attr, normal, left, undefined, back, vertexFormat);
                back -= 3;
            }
            rightEdge = positions[posIndex++];
            leftEdge = positions[posIndex++];
            rightEdge.splice(0, 3); //remove duplicate points added by corner
            leftEdge.splice(leftEdge.length - 3, 3);
            finalPositions.set(rightEdge, front);
            finalPositions.set(leftEdge, back - leftEdge.length + 1);
            length = leftEdge.length - 3;

            compIndex += 3;
            left = Cartesian3.fromArray(computedLefts, compIndex, left);
            for (j = 0; j < leftEdge.length; j += 3) {
                rightNormal = ellipsoid.geodeticSurfaceNormal(Cartesian3.fromArray(rightEdge, j, scratch1), scratch1);
                leftNormal = ellipsoid.geodeticSurfaceNormal(Cartesian3.fromArray(leftEdge, length - j, scratch2), scratch2);
                normal = Cartesian3.normalize(Cartesian3.add(rightNormal, leftNormal, normal), normal);
                addNormals(attr, normal, left, front, back, vertexFormat);

                LR = front / 3;
                LL = LR - 1;
                UR = (back - 2) / 3;
                UL = UR + 1;
                indices[index++] = UL;
                indices[index++] = LL;
                indices[index++] = UR;
                indices[index++] = UR;
                indices[index++] = LL;
                indices[index++] = LR;

                front += 3;
                back -= 3;
            }
            front -= 3;
            back += 3;
        }
        normal = Cartesian3.fromArray(computedNormals, computedNormals.length - 3, normal);
        addNormals(attr, normal, left, front, back, vertexFormat);

        if (addEndPositions) { // add rounded end
            front += 3;
            back -= 3;
            leftPos = cartesian3;
            rightPos = cartesian4;
            var lastEndPositions = endPositions[1];
            for (i = 0; i < halfLength; i++) {
                leftPos = Cartesian3.fromArray(lastEndPositions, (endPositionLength - i - 1) * 3, leftPos);
                rightPos = Cartesian3.fromArray(lastEndPositions, i * 3, rightPos);
                CorridorGeometryLibrary.addAttribute(finalPositions, leftPos, undefined, back);
                CorridorGeometryLibrary.addAttribute(finalPositions, rightPos, front);
                addNormals(attr, normal, left, front, back, vertexFormat);

                LR = front / 3;
                LL = LR - 1;
                UR = (back - 2) / 3;
                UL = UR + 1;
                indices[index++] = UL;
                indices[index++] = LL;
                indices[index++] = UR;
                indices[index++] = UR;
                indices[index++] = LL;
                indices[index++] = LR;

                front += 3;
                back -= 3;
            }
        }

        attributes.position = new GeometryAttribute({
            componentDatatype : ComponentDatatype.DOUBLE,
            componentsPerAttribute : 3,
            values : finalPositions
        });

        if (vertexFormat.st) {
            var st = new Float32Array(size / 3 * 2);
            var rightSt;
            var leftSt;
            var stIndex = 0;
            if (addEndPositions) {
                leftCount /= 3;
                rightCount /= 3;
                var theta = Math.PI / (endPositionLength + 1);
                leftSt = 1 / (leftCount - endPositionLength + 1);
                rightSt = 1 / (rightCount - endPositionLength + 1);
                var a;
                var halfEndPos = endPositionLength / 2;
                for (i = halfEndPos + 1; i < endPositionLength + 1; i++) { // lower left rounded end
                    a = CesiumMath.PI_OVER_TWO + theta * i;
                    st[stIndex++] = rightSt * (1 + Math.cos(a));
                    st[stIndex++] = 0.5 * (1 + Math.sin(a));
                }
                for (i = 1; i < rightCount - endPositionLength + 1; i++) { // bottom edge
                    st[stIndex++] = i * rightSt;
                    st[stIndex++] = 0;
                }
                for (i = endPositionLength; i > halfEndPos; i--) { // lower right rounded end
                    a = CesiumMath.PI_OVER_TWO - i * theta;
                    st[stIndex++] = 1 - rightSt * (1 + Math.cos(a));
                    st[stIndex++] = 0.5 * (1 + Math.sin(a));
                }
                for (i = halfEndPos; i > 0; i--) { // upper right rounded end
                    a = CesiumMath.PI_OVER_TWO - theta * i;
                    st[stIndex++] = 1 - leftSt * (1 + Math.cos(a));
                    st[stIndex++] = 0.5 * (1 + Math.sin(a));
                }
                for (i = leftCount - endPositionLength; i > 0; i--) { // top edge
                    st[stIndex++] = i * leftSt;
                    st[stIndex++] = 1;
                }
                for (i = 1; i < halfEndPos + 1; i++) { // upper left rounded end
                    a = CesiumMath.PI_OVER_TWO + theta * i;
                    st[stIndex++] = leftSt * (1 + Math.cos(a));
                    st[stIndex++] = 0.5 * (1 + Math.sin(a));
                }
            } else {
                leftCount /= 3;
                rightCount /= 3;
                leftSt = 1 / (leftCount - 1);
                rightSt = 1 / (rightCount - 1);
                for (i = 0; i < rightCount; i++) { // bottom edge
                    st[stIndex++] = i * rightSt;
                    st[stIndex++] = 0;
                }
                for (i = leftCount; i > 0; i--) { // top edge
                    st[stIndex++] = (i - 1) * leftSt;
                    st[stIndex++] = 1;
                }
            }

            attributes.st = new GeometryAttribute({
                componentDatatype : ComponentDatatype.FLOAT,
                componentsPerAttribute : 2,
                values : st
            });
        }

        if (vertexFormat.normal) {
            attributes.normal = new GeometryAttribute({
                componentDatatype : ComponentDatatype.FLOAT,
                componentsPerAttribute : 3,
                values : attr.normals
            });
        }

        if (vertexFormat.tangent) {
            attributes.tangent = new GeometryAttribute({
                componentDatatype : ComponentDatatype.FLOAT,
                componentsPerAttribute : 3,
                values : attr.tangents
            });
        }

        if (vertexFormat.binormal) {
            attributes.binormal = new GeometryAttribute({
                componentDatatype : ComponentDatatype.FLOAT,
                componentsPerAttribute : 3,
                values : attr.binormals
            });
        }

        return {
            attributes : attributes,
            indices : indices
        };
    }

    function extrudedAttributes(attributes, vertexFormat) {
        if (!vertexFormat.normal && !vertexFormat.binormal && !vertexFormat.tangent && !vertexFormat.st) {
            return attributes;
        }
        var positions = attributes.position.values;
        var topNormals;
        var topBinormals;
        if (vertexFormat.normal || vertexFormat.binormal) {
            topNormals = attributes.normal.values;
            topBinormals = attributes.binormal.values;
        }
        var size = attributes.position.values.length / 18;
        var threeSize = size * 3;
        var twoSize = size * 2;
        var sixSize = threeSize * 2;
        var i;
        if (vertexFormat.normal || vertexFormat.binormal || vertexFormat.tangent) {
            var normals = (vertexFormat.normal) ? new Float32Array(threeSize * 6) : undefined;
            var binormals = (vertexFormat.binormal) ? new Float32Array(threeSize * 6) : undefined;
            var tangents = (vertexFormat.tangent) ? new Float32Array(threeSize * 6) : undefined;
            var topPosition = cartesian1;
            var bottomPosition = cartesian2;
            var previousPosition = cartesian3;
            var normal = cartesian4;
            var tangent = cartesian5;
            var binormal = cartesian6;
            var attrIndex = sixSize;
            for (i = 0; i < threeSize; i += 3) {
                var attrIndexOffset = attrIndex + sixSize;
                topPosition      = Cartesian3.fromArray(positions, i, topPosition);
                bottomPosition   = Cartesian3.fromArray(positions, i + threeSize, bottomPosition);
                previousPosition = Cartesian3.fromArray(positions, (i + 3) % threeSize, previousPosition);
                bottomPosition   = Cartesian3.subtract(bottomPosition,   topPosition, bottomPosition);
                previousPosition = Cartesian3.subtract(previousPosition, topPosition, previousPosition);
                normal = Cartesian3.normalize(Cartesian3.cross(bottomPosition, previousPosition, normal), normal);
                if (vertexFormat.normal) {
                    CorridorGeometryLibrary.addAttribute(normals, normal, attrIndexOffset);
                    CorridorGeometryLibrary.addAttribute(normals, normal, attrIndexOffset + 3);
                    CorridorGeometryLibrary.addAttribute(normals, normal, attrIndex);
                    CorridorGeometryLibrary.addAttribute(normals, normal, attrIndex + 3);
                }
                if (vertexFormat.tangent || vertexFormat.binormal) {
                    binormal = Cartesian3.fromArray(topNormals, i, binormal);
                    if (vertexFormat.binormal) {
                        CorridorGeometryLibrary.addAttribute(binormals, binormal, attrIndexOffset);
                        CorridorGeometryLibrary.addAttribute(binormals, binormal, attrIndexOffset + 3);
                        CorridorGeometryLibrary.addAttribute(binormals, binormal, attrIndex);
                        CorridorGeometryLibrary.addAttribute(binormals, binormal, attrIndex + 3);
                    }

                    if (vertexFormat.tangent) {
                        tangent = Cartesian3.normalize(Cartesian3.cross(binormal, normal, tangent), tangent);
                        CorridorGeometryLibrary.addAttribute(tangents, tangent, attrIndexOffset);
                        CorridorGeometryLibrary.addAttribute(tangents, tangent, attrIndexOffset + 3);
                        CorridorGeometryLibrary.addAttribute(tangents, tangent, attrIndex);
                        CorridorGeometryLibrary.addAttribute(tangents, tangent, attrIndex + 3);
                    }
                }
                attrIndex += 6;
            }

            if (vertexFormat.normal) {
                normals.set(topNormals); //top
                for (i = 0; i < threeSize; i += 3) { //bottom normals
                    normals[i + threeSize] = -topNormals[i];
                    normals[i + threeSize + 1] = -topNormals[i + 1];
                    normals[i + threeSize + 2] = -topNormals[i + 2];
                }
                attributes.normal.values = normals;
            } else {
                attributes.normal = undefined;
            }

            if (vertexFormat.binormal) {
                binormals.set(topBinormals); //top
                binormals.set(topBinormals, threeSize); //bottom
                attributes.binormal.values = binormals;
            } else {
                attributes.binormal = undefined;
            }

            if (vertexFormat.tangent) {
                var topTangents = attributes.tangent.values;
                tangents.set(topTangents); //top
                tangents.set(topTangents, threeSize); //bottom
                attributes.tangent.values = tangents;
            }
        }
        if (vertexFormat.st) {
            var topSt = attributes.st.values;
            var st = new Float32Array(twoSize * 6);
            st.set(topSt); //top
            st.set(topSt, twoSize); //bottom
            var index = twoSize * 2;

            for ( var j = 0; j < 2; j++) {
                st[index++] = topSt[0];
                st[index++] = topSt[1];
                for (i = 2; i < twoSize; i += 2) {
                    var s = topSt[i];
                    var t = topSt[i + 1];
                    st[index++] = s;
                    st[index++] = t;
                    st[index++] = s;
                    st[index++] = t;
                }
                st[index++] = topSt[0];
                st[index++] = topSt[1];
            }
            attributes.st.values = st;
        }

        return attributes;
    }

    function addWallPositions(positions, index, wallPositions) {
        wallPositions[index++] = positions[0];
        wallPositions[index++] = positions[1];
        wallPositions[index++] = positions[2];
        for ( var i = 3; i < positions.length; i += 3) {
            var x = positions[i];
            var y = positions[i + 1];
            var z = positions[i + 2];
            wallPositions[index++] = x;
            wallPositions[index++] = y;
            wallPositions[index++] = z;
            wallPositions[index++] = x;
            wallPositions[index++] = y;
            wallPositions[index++] = z;
        }
        wallPositions[index++] = positions[0];
        wallPositions[index++] = positions[1];
        wallPositions[index++] = positions[2];

        return wallPositions;
    }

    function computePositionsExtruded(params, vertexFormat) {
        var topVertexFormat = new VertexFormat({
            position : vertexFormat.positon,
            normal : (vertexFormat.normal || vertexFormat.binormal),
            tangent : vertexFormat.tangent,
            binormal : (vertexFormat.normal || vertexFormat.binormal),
            st : vertexFormat.st
        });
        var ellipsoid = params.ellipsoid;
        var computedPositions = CorridorGeometryLibrary.computePositions(params);
        var attr = combine(computedPositions, topVertexFormat, ellipsoid);
        var height = params.height;
        var extrudedHeight = params.extrudedHeight;
        var attributes = attr.attributes;
        var indices = attr.indices;
        var positions = attributes.position.values;
        var length = positions.length;
        var newPositions = new Float64Array(length * 6);
        var extrudedPositions = new Float64Array(length);
        extrudedPositions.set(positions);
        var wallPositions = new Float64Array(length * 4);

        positions = CorridorGeometryLibrary.scaleToGeodeticHeight(positions, height, ellipsoid, positions);
        wallPositions = addWallPositions(positions, 0, wallPositions);
        extrudedPositions = CorridorGeometryLibrary.scaleToGeodeticHeight(extrudedPositions, extrudedHeight, ellipsoid, extrudedPositions);
        wallPositions = addWallPositions(extrudedPositions, length * 2, wallPositions);
        newPositions.set(positions);
        newPositions.set(extrudedPositions, length);
        newPositions.set(wallPositions, length * 2);
        attributes.position.values = newPositions;

        length /= 3;
        var i;
        var iLength = indices.length;
        var twoLength = length + length;
        var newIndices = IndexDatatype.createTypedArray(newPositions.length / 3, iLength * 2 + twoLength * 3);
        newIndices.set(indices);
        var index = iLength;
        for (i = 0; i < iLength; i += 3) { // bottom indices
            var v0 = indices[i];
            var v1 = indices[i + 1];
            var v2 = indices[i + 2];
            newIndices[index++] = v2 + length;
            newIndices[index++] = v1 + length;
            newIndices[index++] = v0 + length;
        }

        attributes = extrudedAttributes(attributes, vertexFormat);
        var UL, LL, UR, LR;

        for (i = 0; i < twoLength; i += 2) { //wall indices
            UL = i + twoLength;
            LL = UL + twoLength;
            UR = UL + 1;
            LR = LL + 1;
            newIndices[index++] = UL;
            newIndices[index++] = LL;
            newIndices[index++] = UR;
            newIndices[index++] = UR;
            newIndices[index++] = LL;
            newIndices[index++] = LR;
        }

        return {
            attributes : attributes,
            indices : newIndices
        };
    }

    /**
     * A description of a corridor. Corridor geometry can be rendered with both {@link Primitive} and {@link GroundPrimitive}.
     *
     * @alias CorridorGeometry
     * @constructor
     *
     * @param {Object} options Object with the following properties:
     * @param {Cartesian3[]} options.positions An array of positions that define the center of the corridor.
     * @param {Number} options.width The distance between the edges of the corridor in meters.
     * @param {Ellipsoid} [options.ellipsoid=Ellipsoid.WGS84] The ellipsoid to be used as a reference.
     * @param {Number} [options.granularity=CesiumMath.RADIANS_PER_DEGREE] The distance, in radians, between each latitude and longitude. Determines the number of positions in the buffer.
     * @param {Number} [options.height=0] The distance in meters between the ellipsoid surface and the positions.
     * @param {Number} [options.extrudedHeight] The distance in meters between the ellipsoid surface and the extrusion.
     * @param {VertexFormat} [options.vertexFormat=VertexFormat.DEFAULT] The vertex attributes to be computed.
     * @param {CornerType} [options.cornerType=CornerType.ROUNDED] Determines the style of the corners.
     *
     * @see CorridorGeometry.createGeometry
     * @see Packable
     *
     * @demo {@link http://cesiumjs.org/Cesium/Apps/Sandcastle/index.html?src=Corridor.html|Cesium Sandcastle Corridor Demo}
     *
     * @example
     * var corridor = new Cesium.CorridorGeometry({
     *   vertexFormat : Cesium.VertexFormat.POSITION_ONLY,
     *   positions : Cesium.Cartesian3.fromDegreesArray([-72.0, 40.0, -70.0, 35.0]),
     *   width : 100000
     * });
     */
    function CorridorGeometry(options) {
        options = defaultValue(options, defaultValue.EMPTY_OBJECT);
        var positions = options.positions;
        var width = options.width;

        //>>includeStart('debug', pragmas.debug);
        if (!defined(positions)) {
            throw new DeveloperError('options.positions is required.');
        }
        if (!defined(width)) {
            throw new DeveloperError('options.width is required.');
        }
        //>>includeEnd('debug');

        this._positions = positions;
        this._ellipsoid = Ellipsoid.clone(defaultValue(options.ellipsoid, Ellipsoid.WGS84));
        this._vertexFormat = VertexFormat.clone(defaultValue(options.vertexFormat, VertexFormat.DEFAULT));
        this._width = width;
        this._height = defaultValue(options.height, 0);
        this._extrudedHeight = defaultValue(options.extrudedHeight, this._height);
        this._cornerType = defaultValue(options.cornerType, CornerType.ROUNDED);
        this._granularity = defaultValue(options.granularity, CesiumMath.RADIANS_PER_DEGREE);
        this._workerName = 'createCorridorGeometry';

        /**
         * The number of elements used to pack the object into an array.
         * @type {Number}
         */
        this.packedLength = 1 + positions.length * Cartesian3.packedLength + Ellipsoid.packedLength + VertexFormat.packedLength + 5;
    }

    /**
     * Stores the provided instance into the provided array.
     *
     * @param {CorridorGeometry} value The value to pack.
     * @param {Number[]} array The array to pack into.
     * @param {Number} [startingIndex=0] The index into the array at which to start packing the elements.
     */
    CorridorGeometry.pack = function(value, array, startingIndex) {
        //>>includeStart('debug', pragmas.debug);
        if (!defined(value)) {
            throw new DeveloperError('value is required');
        }
        if (!defined(array)) {
            throw new DeveloperError('array is required');
        }
        //>>includeEnd('debug');

        startingIndex = defaultValue(startingIndex, 0);

        var positions = value._positions;
        var length = positions.length;
        array[startingIndex++] = length;

        for (var i = 0; i < length; ++i, startingIndex += Cartesian3.packedLength) {
            Cartesian3.pack(positions[i], array, startingIndex);
        }

        Ellipsoid.pack(value._ellipsoid, array, startingIndex);
        startingIndex += Ellipsoid.packedLength;

        VertexFormat.pack(value._vertexFormat, array, startingIndex);
        startingIndex += VertexFormat.packedLength;

        array[startingIndex++] = value._width;
        array[startingIndex++] = value._height;
        array[startingIndex++] = value._extrudedHeight;
        array[startingIndex++] = value._cornerType;
        array[startingIndex]   = value._granularity;
    };

    var scratchEllipsoid = Ellipsoid.clone(Ellipsoid.UNIT_SPHERE);
    var scratchVertexFormat = new VertexFormat();
    var scratchOptions = {
        positions : undefined,
        ellipsoid : scratchEllipsoid,
        vertexFormat : scratchVertexFormat,
        width : undefined,
        height : undefined,
        extrudedHeight : undefined,
        cornerType : undefined,
        granularity : undefined
    };

    /**
     * Retrieves an instance from a packed array.
     *
     * @param {Number[]} array The packed array.
     * @param {Number} [startingIndex=0] The starting index of the element to be unpacked.
     * @param {CorridorGeometry} [result] The object into which to store the result.
     * @returns {CorridorGeometry} The modified result parameter or a new CorridorGeometry instance if one was not provided.
     */
    CorridorGeometry.unpack = function(array, startingIndex, result) {
        //>>includeStart('debug', pragmas.debug);
        if (!defined(array)) {
            throw new DeveloperError('array is required');
        }
        //>>includeEnd('debug');

        startingIndex = defaultValue(startingIndex, 0);

        var length = array[startingIndex++];
        var positions = new Array(length);

        for (var i = 0; i < length; ++i, startingIndex += Cartesian3.packedLength) {
            positions[i] = Cartesian3.unpack(array, startingIndex);
        }

        var ellipsoid = Ellipsoid.unpack(array, startingIndex, scratchEllipsoid);
        startingIndex += Ellipsoid.packedLength;

        var vertexFormat = VertexFormat.unpack(array, startingIndex, scratchVertexFormat);
        startingIndex += VertexFormat.packedLength;

        var width = array[startingIndex++];
        var height = array[startingIndex++];
        var extrudedHeight = array[startingIndex++];
        var cornerType = array[startingIndex++];
        var granularity = array[startingIndex];

        if (!defined(result)) {
            scratchOptions.positions = positions;
            scratchOptions.width = width;
            scratchOptions.height = height;
            scratchOptions.extrudedHeight = extrudedHeight;
            scratchOptions.cornerType = cornerType;
            scratchOptions.granularity = granularity;
            return new CorridorGeometry(scratchOptions);
        }

        result._positions = positions;
        result._ellipsoid = Ellipsoid.clone(ellipsoid, result._ellipsoid);
        result._vertexFormat = VertexFormat.clone(vertexFormat, result._vertexFormat);
        result._width = width;
        result._height = height;
        result._extrudedHeight = extrudedHeight;
        result._cornerType = cornerType;
        result._granularity = granularity;

        return result;
    };

    /**
     * Computes the geometric representation of a corridor, including its vertices, indices, and a bounding sphere.
     *
     * @param {CorridorGeometry} corridorGeometry A description of the corridor.
     * @returns {Geometry|undefined} The computed vertices and indices.
     */
    CorridorGeometry.createGeometry = function(corridorGeometry) {
        var positions = corridorGeometry._positions;
        var height = corridorGeometry._height;
        var extrudedHeight = corridorGeometry._extrudedHeight;
        var extrude = (height !== extrudedHeight);

        var cleanPositions = PolylinePipeline.removeDuplicates(positions);

        if (cleanPositions.length < 2) {
            return undefined;
        }

        var ellipsoid = corridorGeometry._ellipsoid;
        var vertexFormat = corridorGeometry._vertexFormat;
        var params = {
            ellipsoid : ellipsoid,
            positions : cleanPositions,
            width : corridorGeometry._width,
            cornerType : corridorGeometry._cornerType,
            granularity : corridorGeometry._granularity,
            saveAttributes: true
        };
        var attr;
        if (extrude) {
            var h = Math.max(height, extrudedHeight);
            extrudedHeight = Math.min(height, extrudedHeight);
            height = h;
            params.height = height;
            params.extrudedHeight = extrudedHeight;
            attr = computePositionsExtruded(params, vertexFormat);
        } else {
            var computedPositions = CorridorGeometryLibrary.computePositions(params);
            attr = combine(computedPositions, vertexFormat, ellipsoid);
            attr.attributes.position.values = CorridorGeometryLibrary.scaleToGeodeticHeight(attr.attributes.position.values, height, ellipsoid, attr.attributes.position.values);
        }
        var attributes = attr.attributes;
        var boundingSphere = BoundingSphere.fromVertices(attributes.position.values, undefined, 3);
        if (!vertexFormat.position) {
            attr.attributes.position.values = undefined;
        }

        return new Geometry({
            attributes : attributes,
            indices : attr.indices,
            primitiveType : PrimitiveType.TRIANGLES,
            boundingSphere : boundingSphere
        });
    };

    /**
     * @private
     */
    CorridorGeometry.createShadowVolume = function(corridorGeometry, minHeightFunc, maxHeightFunc) {
        var granularity = corridorGeometry._granularity;
        var ellipsoid = corridorGeometry._ellipsoid;

        var minHeight = minHeightFunc(granularity, ellipsoid);
        var maxHeight = maxHeightFunc(granularity, ellipsoid);

        return new CorridorGeometry({
            positions : corridorGeometry._positions,
            width : corridorGeometry._width,
            cornerType : corridorGeometry._cornerType,
            ellipsoid : ellipsoid,
            granularity : granularity,
            extrudedHeight : minHeight,
            height : maxHeight,
            vertexFormat : VertexFormat.POSITION_ONLY
        });
    };

    return CorridorGeometry;
});
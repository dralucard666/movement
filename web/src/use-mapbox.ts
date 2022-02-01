import { MatrixEntry, InterpretionValue, Parameters } from "cgv"
import { useMemo } from "react"
import { Matrix4, Shape, Vector2 } from "three"
import { Layers, loadLayers } from "./api"
import { Instance } from "cgv/domains/shape"
import { from, map, Observable, of, shareReplay } from "rxjs"
import { CombinedPrimitive, FacePrimitive, LinePrimitive, Primitive } from "cgv/domains/shape/primitive"

const roadParameters: Parameters = {
    layer: of("road"),
}
const buildingParameters: Parameters = {
    layer: of("building"),
}

export function useMapbox() {
    return useMemo(
        () =>
            from(loadLayers()).pipe(
                shareReplay({ bufferSize: 1, refCount: true }),
                map((layers) => {
                    const roads = getRoads(layers)
                    const buildings = getBuildings(layers)
                    const changes = [...roads, ...buildings].map<MatrixEntry<Observable<InterpretionValue<Instance>>>>(
                        ([primitive, parameters], i) => ({
                            index: [i],
                            value: of({
                                terminated: false,
                                eventDepthMap: {},
                                parameters,
                                value: {
                                    path: [i],
                                    attributes: {},
                                    primitive,
                                },
                            }),
                        })
                    )
                    return changes
                })
            ),
        []
    )
}

function getBuildings(layers: Layers): Array<[Primitive, Parameters]> {
    return layers["building"].reduce<Array<[Primitive, Parameters]>>(
        (prev, feature) =>
            prev.concat(
                feature.geometry.map<[Primitive, Parameters]>((lot) => [
                    new FacePrimitive(new Matrix4(), new Shape(lot.map(({ x, y }) => new Vector2(x, y)))),
                    buildingParameters,
                ])
            ),
        []
    )
}

function getRoads(layers: Layers): Array<[Primitive, Parameters]> {
    return layers["road"]
        .filter((feature) => feature.properties.class === "street")
        .reduce<Array<[Primitive, Parameters]>>(
            (prev, feature) =>
                prev.concat(
                    feature.geometry.map((geoemtry) => [
                        new CombinedPrimitive(
                            new Matrix4(),
                            geoemtry.slice(0, -1).map((p1, i) => {
                                const p2 = geoemtry[(i + 1) % geoemtry.length]
                                return LinePrimitive.fromPoints(
                                    new Matrix4(),
                                    new Vector2(p1.x, p1.y),
                                    new Vector2(p2.x, p2.y)
                                )
                            })
                        ),
                        roadParameters,
                    ])
                ),
            []
        )
}

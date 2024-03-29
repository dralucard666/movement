/*
Auto-generated by: https://github.com/pmndrs/gltfjsx
*/

import * as THREE from "three"
import React, { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { useGLTF, useAnimations } from "@react-three/drei"
import { GLTF, SkeletonUtils } from "three-stdlib"
import { AnimationClip, Group, RingGeometry } from "three"
import { extend, useFrame, useGraph } from "@react-three/fiber"
import { movObject, useMovementStore } from "./useMovementStore"
import { Cyclist } from "./cyclist"
import { ObjectType } from "cgv/domains/movement"
import { TextComponent } from "./text"
import { Truck } from "./truck"
import { Person } from "./person"
import { Marker } from "./marker"
import { getExtraData } from "./objectDataScene"
import { WorldState, WorldEnum } from "./movementData"
import { UseBaseStore, useBaseStore } from "../../global"

export default function MovementLogic(props: { id: string; data: movObject; world: WorldState; store: UseBaseStore }) {
    const object = useRef<any>()
    const text = useRef<any>()
    const marker = useRef<any>()

    //const store = props.store
    const descriptionName = props.id.split("_")[0]
    const type = props.data.type
    const testType: ObjectType = ObjectType.Car as ObjectType

    const isMarked = true
    const scene = props.world.enumName as WorldEnum

    const [lineOffsetX, lineOffsetY, lineLength, textMarginX, textMarginY, positionY, rotationY, scale] = getExtraData(
        scene,
        type
    )
    const PersonComp = useMemo(() => {
        switch (type) {
            case ObjectType.Cyclist:
                return <Cyclist key={props.id} id={props.id} ref={object} scale={scale} positionY={positionY}></Cyclist>
            case ObjectType.Pedestrian:
                return <Person key={props.id} id={props.id} ref={object} scale={scale} positionY={positionY}></Person>
            case ObjectType.Car:
                return <Truck key={props.id} id={props.id} ref={object} scale={scale} positionY={positionY}></Truck>
            default:
                return <Person key={props.id} id={props.id} ref={object} scale={scale} positionY={positionY}></Person>
        }
    }, [props])
    const line = useRef<any>()

    const data = props.data

    useEffect(() => {
        if (object.current && data.framePos.length > 0) {
            const firstPos = data.framePos[0]
            if (firstPos.position) {
                const x = firstPos.position[0]
                const y = firstPos.position[1]
                const z = firstPos.position[2]
                object.current.updatePosition(x, y, z, rotationY, 0)
                text.current.updatePosition(x + textMarginX, y + textMarginY, z)
            }
        }
    }, [object, props])

    useFrame((state, delta) => {
        const currentTime = useMovementStore.getState().time
        const playActive = useMovementStore.getState().getPlayActive()

        if (data.startT <= currentTime && currentTime <= data.endT && data.framePos) {
            const arrayIndex = currentTime - data.startT
            const currentLine = data.framePos[arrayIndex]
            const direction = currentLine.direction
            if (currentLine.position && object.current && line.current && direction) {
                object.current.showObject()
                line.current.visible = true
                text.current.showText()

                const positionX = currentLine.position[0]
                const positionY = currentLine.position[1]
                const positionZ = currentLine.position[2]

                const angle = -Math.atan2(direction[2], direction[0]) + rotationY
                object.current.updatePosition(
                    positionX,
                    positionY,
                    positionZ,
                    angle,
                    playActive ? delta : Math.random()
                )
                text.current.updatePosition(positionX + textMarginX, positionY + textMarginY, positionZ)
                /*                 if (isMarked) {
                    marker.current.updatePosition(positionX, positionY, positionZ)
                } */

                const oldLinePos = [positionX, lineOffsetY, positionZ]
                const newLinePos = [
                    positionX + direction[0] * lineLength,
                    lineOffsetY + 2,
                    positionZ + direction[2] * lineLength,
                ]
                line.current.geometry.setFromPoints(
                    [oldLinePos, newLinePos].map((point) => new THREE.Vector3(...point))
                )
            }
        } else {
            if (object.current && line.current && text.current) {
                object.current.hideObject()
                line.current.visible = false
                text.current.hideText()
            }
        }
    })

    return (
        <>
            {/*             {isMarked ? <Marker type={type} scene={"bookstore"} ref={marker} /> : null}
             */}{" "}
            <Suspense fallback={null}>
                <group
                    onClick={() => {
                        props.store.getState().selectDescription(descriptionName, false)
                    }}>
                    {PersonComp}
                </group>
                <TextComponent {...{ text: props.id }} ref={text} />
            </Suspense>
            <line ref={line}>
                <bufferGeometry />
                <lineBasicMaterial attach="material" color={"#9c88ff"} linewidth={100} />
            </line>
        </>
    )
}

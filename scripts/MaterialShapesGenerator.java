/*
 * Copyright 2024 The Android Open Source Project
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed
 * under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
 * CONDITIONS OF ANY KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations under the License.
 *
 * Modified by Sidekick: Java port of the numeric recipes, repetition and transforms
 * from MaterialShapes.kt, AndroidX snapshot 9a589fa61f8661e0cbef9123dcc98d3c1f655fc7.
 * Shape construction, rounding, smoothing and normalization use the unmodified
 * official androidx.graphics:graphics-shapes-android:1.1.0 library.
 * This developer-only generator is never loaded by the application.
 */
import java.util.*;
import java.lang.reflect.*;
import androidx.graphics.shapes.*;
class MaterialShapesGenerator {
  static CornerRounding round(float r) { return new CornerRounding(r, 0); }
  static RoundedPolygon transform(RoundedPolygon p, float angle, float sx, float sy) {
    float a = angle / 360f * 2f * (float)Math.PI, c=(float)Math.cos(a), s=(float)Math.sin(a);
    PointTransformer tx = (PointTransformer)Proxy.newProxyInstance(PointTransformer.class.getClassLoader(),new Class[]{PointTransformer.class},(o,m,args)->{
      float x=(Float)args[0]*sx,y=(Float)args[1]*sy;
      return ((long)Float.floatToRawIntBits(x*c-y*s)<<32) | (Float.floatToRawIntBits(x*s+y*c)&0xffffffffL);
    });
    return p.transformed(tx);
  }
  static RoundedPolygon custom(float[][] p, int reps, boolean mirror) {
    List<Float> xy=new ArrayList<>(); List<CornerRounding> r=new ArrayList<>();
    int total=mirror?reps*2:reps;
    float section=360f/total;
    float a0=(float)Math.atan2(p[0][1]-.5f,p[0][0]-.5f)*180f/(float)Math.PI;
    for(int j=0;j<total;j++) for(int index=0;index<p.length;index++) {
      int i=mirror&&j%2==1?p.length-1-index:index;
      if(mirror&&i==0&&j%2==1)continue;
      float x=p[i][0]-.5f,y=p[i][1]-.5f;
      if(mirror) {
        float angle=(float)Math.atan2(y,x)*180f/(float)Math.PI;
        float a=(section*j+(j%2==0?angle:section-angle+2*a0))/360f*2f*(float)Math.PI;
        float d=(float)Math.sqrt(x*x+y*y);
        xy.add((float)Math.cos(a)*d+.5f);xy.add((float)Math.sin(a)*d+.5f);
      } else {
        float a=(j*360f/reps)/360f*2f*(float)Math.PI,c=(float)Math.cos(a),s=(float)Math.sin(a);
        xy.add(x*c-y*s+.5f);xy.add(x*s+y*c+.5f);
      }
      r.add(new CornerRounding(p[i][2],p[i][3]));
    }
    float[] vertices=new float[xy.size()];for(int i=0;i<vertices.length;i++)vertices[i]=xy.get(i);
    return RoundedPolygonKt.RoundedPolygon(vertices,new CornerRounding(),r,.5f,.5f);
  }
  static void output(String name, RoundedPolygon p) {
    p=p.normalized();
    System.out.print("\""+name+"\": ["); boolean first=true;
    for(Cubic c:p.getCubics()){
      if(!first)System.out.print(",");first=false;
      System.out.print("["+c.getAnchor0X()+","+c.getAnchor0Y()+","+c.getControl0X()+","+c.getControl0Y()+","+c.getControl1X()+","+c.getControl1Y()+","+c.getAnchor1X()+","+c.getAnchor1Y()+"]");
    }
    System.out.print("]");
  }
  public static void main(String[] args) {
    Map<String,RoundedPolygon> shapes = new LinkedHashMap<>();
    shapes.put("circle",ShapesKt.circle(RoundedPolygon.Companion,10));
    shapes.put("square",ShapesKt.rectangle(RoundedPolygon.Companion,1,1,round(.3f),null,0,0));
    shapes.put("arch",transform(RoundedPolygonKt.RoundedPolygon(4,1,0,0,new CornerRounding(),List.of(round(1),round(1),round(.2f),round(.2f))),-135,1,1));
    shapes.put("semiCircle",ShapesKt.rectangle(RoundedPolygon.Companion,1.6f,1, new CornerRounding(),List.of(round(.2f),round(.2f),round(1),round(1)),0,0));
    shapes.put("oval",transform(ShapesKt.circle(RoundedPolygon.Companion),-45,1,.64f));
    shapes.put("triangle",transform(RoundedPolygonKt.RoundedPolygon(3,1,0,0,round(.2f)),-90,1,1));
    shapes.put("sunny",ShapesKt.star(RoundedPolygon.Companion,8,1,.8f,round(.15f)));
    shapes.put("cookie7Sided",transform(ShapesKt.star(RoundedPolygon.Companion,7,1,.75f,round(.5f)),-90,1,1));
    shapes.put("cookie9Sided",transform(ShapesKt.star(RoundedPolygon.Companion,9,1,.8f,round(.5f)),-90,1,1));
    shapes.put("cookie12Sided",transform(ShapesKt.star(RoundedPolygon.Companion,12,1,.8f,round(.5f)),-90,1,1));

    shapes.put("slanted",custom(new float[][]{{0.926f,0.97f,0.189f,0.811f},{-0.021f,0.967f,0.187f,0.057f}},2,false));
    shapes.put("fan",custom(new float[][]{{1.004f,1.0f,0.148f,0.417f},{0.0f,1.0f,0.151f,0.0f},{0.0f,-0.003f,0.148f,0.0f},{0.978f,0.02f,0.803f,0.0f}},1,false));
    shapes.put("arrow",custom(new float[][]{{0.5f,0.892f,0.313f,0.0f},{-0.216f,1.05f,0.207f,0.0f},{0.499f,-0.16f,0.215f,1.0f},{1.225f,1.06f,0.211f,0.0f}},1,false));
    shapes.put("pill",custom(new float[][]{{0.961f,0.039f,0.426f,0.0f},{1.001f,0.428f,0.0f,0.0f},{1.0f,0.609f,1.0f,0.0f}},2,true));
    shapes.put("diamond",custom(new float[][]{{0.5f,1.096f,0.151f,0.524f},{0.04f,0.5f,0.159f,0.0f}},2,false));
    shapes.put("clamShell",custom(new float[][]{{0.171f,0.841f,0.159f,0.0f},{-0.02f,0.5f,0.14f,0.0f},{0.17f,0.159f,0.159f,0.0f}},2,false));
    shapes.put("pentagon",custom(new float[][]{{0.5f,-0.009f,0.172f,0.0f},{1.03f,0.365f,0.164f,0.0f},{0.828f,0.97f,0.169f,0.0f}},1,true));
    shapes.put("gem",custom(new float[][]{{0.499f,1.023f,0.241f,0.778f},{-0.005f,0.792f,0.208f,0.0f},{0.073f,0.258f,0.228f,0.0f},{0.433f,-0.0f,0.491f,0.0f}},1,true));
    shapes.put("verySunny",custom(new float[][]{{0.5f,1.08f,0.085f,0.0f},{0.358f,0.843f,0.085f,0.0f}},8,false));
    shapes.put("cookie4Sided",custom(new float[][]{{1.237f,1.236f,0.258f,0.0f},{0.5f,0.918f,0.233f,0.0f}},4,false));
    shapes.put("cookie6Sided",custom(new float[][]{{0.723f,0.884f,0.394f,0.0f},{0.5f,1.099f,0.398f,0.0f}},6,false));
    shapes.put("ghostish",custom(new float[][]{{0.5f,0.0f,1.0f,0.0f},{1.0f,0.0f,1.0f,0.0f},{1.0f,1.14f,0.254f,0.106f},{0.575f,0.906f,0.253f,0.0f}},1,true));
    shapes.put("clover4Leaf",custom(new float[][]{{0.5f,0.074f,0.0f,0.0f},{0.725f,-0.099f,0.476f,0.0f}},4,true));
    shapes.put("clover8Leaf",custom(new float[][]{{0.5f,0.036f,0.0f,0.0f},{0.758f,-0.101f,0.209f,0.0f}},8,false));
    shapes.put("burst",custom(new float[][]{{0.5f,-0.006f,0.006f,0.0f},{0.592f,0.158f,0.006f,0.0f}},12,false));
    shapes.put("softBurst",custom(new float[][]{{0.193f,0.277f,0.053f,0.0f},{0.176f,0.055f,0.053f,0.0f}},10,false));
    shapes.put("boom",custom(new float[][]{{0.457f,0.296f,0.007f,0.0f},{0.5f,-0.051f,0.007f,0.0f}},15,false));
    shapes.put("softBoom",custom(new float[][]{{0.733f,0.454f,0.0f,0.0f},{0.839f,0.437f,0.532f,0.0f},{0.949f,0.449f,0.439f,1.0f},{0.998f,0.478f,0.174f,0.0f}},16,true));
    shapes.put("flower",custom(new float[][]{{0.37f,0.187f,0.0f,0.0f},{0.416f,0.049f,0.381f,0.0f},{0.479f,0.001f,0.095f,0.0f}},8,true));
    shapes.put("puffy",transform(custom(new float[][]{{0.5f,0.053f,0.0f,0.0f},{0.545f,-0.04f,0.405f,0.0f},{0.67f,-0.035f,0.426f,0.0f},{0.717f,0.066f,0.574f,0.0f},{0.722f,0.128f,0.0f,0.0f},{0.777f,0.002f,0.36f,0.0f},{0.914f,0.149f,0.66f,0.0f},{0.926f,0.289f,0.66f,0.0f},{0.881f,0.346f,0.0f,0.0f},{0.94f,0.344f,0.126f,0.0f},{1.003f,0.437f,0.255f,0.0f}},2,true),0,1,0.742f));
    shapes.put("puffyDiamond",custom(new float[][]{{0.87f,0.13f,0.146f,0.0f},{0.818f,0.357f,0.0f,0.0f},{1.0f,0.332f,0.853f,0.0f}},4,true));
    shapes.put("pixelCircle",custom(new float[][]{{0.5f,0.0f,0.0f,0.0f},{0.704f,0.0f,0.0f,0.0f},{0.704f,0.065f,0.0f,0.0f},{0.843f,0.065f,0.0f,0.0f},{0.843f,0.148f,0.0f,0.0f},{0.926f,0.148f,0.0f,0.0f},{0.926f,0.296f,0.0f,0.0f},{1.0f,0.296f,0.0f,0.0f}},2,true));
    shapes.put("pixelTriangle",custom(new float[][]{{0.11f,0.5f,0.0f,0.0f},{0.113f,0.0f,0.0f,0.0f},{0.287f,0.0f,0.0f,0.0f},{0.287f,0.087f,0.0f,0.0f},{0.421f,0.087f,0.0f,0.0f},{0.421f,0.17f,0.0f,0.0f},{0.56f,0.17f,0.0f,0.0f},{0.56f,0.265f,0.0f,0.0f},{0.674f,0.265f,0.0f,0.0f},{0.675f,0.344f,0.0f,0.0f},{0.789f,0.344f,0.0f,0.0f},{0.789f,0.439f,0.0f,0.0f},{0.888f,0.439f,0.0f,0.0f}},1,true));
    shapes.put("bun",custom(new float[][]{{0.796f,0.5f,0.0f,0.0f},{0.853f,0.518f,1.0f,0.0f},{0.992f,0.631f,1.0f,0.0f},{0.968f,1.0f,1.0f,0.0f}},2,true));
    shapes.put("heart",custom(new float[][]{{0.5f,0.268f,0.016f,0.0f},{0.792f,-0.066f,0.958f,0.0f},{1.064f,0.276f,1.0f,0.0f},{0.501f,0.946f,0.129f,0.0f}},1,true));
    System.out.println("{"); boolean first=true;
    for(var e:shapes.entrySet()){if(!first)System.out.println(",");first=false;output(e.getKey(),e.getValue());}
    System.out.println("\n}");
  }
}
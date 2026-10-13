// 由舊版 diagramflow.js 的 link.reSegment 原樣搬移（腳本自動轉換），
// 只把 model / this 換成參數，演算法一行都沒改。請不要手動重排這個檔案。
import { Anchor } from './anchor';
import type { Link, Point } from './link';
import type { FlowNode } from './node';

export function reSegment(link: Link, nodes: (FlowNode | null)[]): void {
  let aC1: Point, aC2: Point, x1: number, x2: number, y1: number, y2: number;
      if (link.mode=="straight" || link.mode==null)
      {
          aC1=nodes[link.from]!.connectorCoords(link.anchorFrom);
          aC2=nodes[link.to]!.connectorCoords(link.anchorTo);
          link.segments=[{x:aC1.x,y:aC1.y},{x:aC2.x,y:aC2.y}];
          link.indexText=1;
      }
      else
      {
          link.segments=[];
          aC1=nodes[link.from]!.connectorCoords(link.anchorFrom);
          aC2=nodes[link.to]!.connectorCoords(link.anchorTo);

          link.segments.push({x:aC1.x,y:aC1.y});
          if (link.mode=="square" && (link.anchors.length==0 || link.anchors.length!=link.new_anchors.length) )
          {
              link.anchors=[];
              link.new_anchors=[];
              const ARROW_DIS = 20;
              x1=aC1.x;
              x2=aC2.x;
              y1=aC1.y;
              y2=aC2.y;
              // console.log(link.anchorFrom)
              if(link.anchorFrom==0){
                  // 左邊節點出
                  link.segments.push({x:aC1.x-ARROW_DIS,y:aC1.y});
                  if(link.anchorTo==0){
                      // 左邊節點入
                      let x3=x1-ARROW_DIS;
                      let y3=y1;
                      let x4=x2-ARROW_DIS;
                      let y4=y2;
                      if(x3<=x4 && y3>=y4){
                          //第一象限
                          link.segments.push({x:x3,y:y4});
                      }
                      else if(x3>x4 && y3>y4){
                          //第二象限
                          link.segments.push({x:x4,y:y3});
                      }
                      else if(x3>=x4 && y3<=y4){
                          //第三象限
                          link.segments.push({x:x4,y:y3});
                      }
                      else{
                          //第四象限
                          link.segments.push({x:x3,y:y4});
                      }

                      link.segments.push({x:aC2.x-ARROW_DIS,y:aC2.y});
                  }
                  else if(link.anchorTo==1){
                      // 上邊節點入
                      let x3=x1-ARROW_DIS;
                      let y3=y1;
                      let x4=x2;
                      let y4=y2-ARROW_DIS;
                      if(x3<=x4 && y3>=y4){
                          //第一象限
                          link.segments.push({x:x3,y:y4});
                      }
                      else if(x3>x4 && y3>y4){
                          //第二象限
                          link.segments.push({x:x3,y:y4});
                      }
                      else if(x3>=x4 && y3<=y4){
                          //第三象限
                          link.segments.push({x:x4,y:y3});
                      }
                      else{
                          //第四象限
                          link.segments.push({x:x3,y:y4});
                      }
                      link.segments.push({x:aC2.x,y:aC2.y-ARROW_DIS});
                  }
                  else if(link.anchorTo==2){
                      // 右邊節點入
                      let x3=x1-ARROW_DIS;
                      let y3=y1;
                      let x4=x2+ARROW_DIS;
                      let y4=y2;
                      if(x3<=x4 && y3>=y4){
                          //第一象限
                          link.segments.push({x:x3,y:(y3+y4)/2});
                          link.segments.push({x:x4,y:(y3+y4)/2});
                      }
                      else if(x3>x4 && y3>y4){
                          //第二象限
                          link.segments.push({x:x3,y:y4});
                      }
                      else if(x3>=x4 && y3<=y4){
                          //第三象限
                          link.segments.push({x:x3,y:y4});
                      }
                      else{
                          //第四象限
                          link.segments.push({x:x3,y:(y3+y4)/2});
                          link.segments.push({x:x4,y:(y3+y4)/2});
                      }
                      link.segments.push({x:aC2.x+ARROW_DIS,y:aC2.y});
                  }
                  else if(link.anchorTo==3){
                      // 下邊節點入
                      let x3=x1-ARROW_DIS;
                      let y3=y1;
                      let x4=x2;
                      let y4=y2+ARROW_DIS;
                      if(x3<=x4 && y3>=y4){
                          //第一象限
                          link.segments.push({x:x3,y:y4});
                      }
                      else if(x3>x4 && y3>y4){
                          //第二象限
                          link.segments.push({x:x4,y:y3});
                      }
                      else if(x3>=x4 && y3<=y4){
                          //第三象限
                          link.segments.push({x:x3,y:y4});
                      }
                      else{
                          //第四象限
                          link.segments.push({x:x3,y:y4});
                      }
                      link.segments.push({x:aC2.x,y:aC2.y+ARROW_DIS});
                  }
              }
              else if(link.anchorFrom==1){
                  // 上邊節點出
                  link.segments.push({x:aC1.x,y:aC1.y-ARROW_DIS});
                  if(link.anchorTo==0){
                      // 左邊節點入
                      let x3=x1;
                      let y3=y1-ARROW_DIS;
                      let x4=x2-ARROW_DIS;
                      let y4=y2;
                      if(x3<=x4 && y3>=y4){
                          //第一象限
                          link.segments.push({x:x3,y:y4});
                      }
                      else if(x3>x4 && y3>y4){
                          //第二象限
                          link.segments.push({x:x4,y:y3});
                      }
                      else if(x3>=x4 && y3<=y4){
                          //第三象限
                          link.segments.push({x:x4,y:y3});
                      }
                      else{
                          //第四象限
                          link.segments.push({x:x4,y:y3});
                      }

                      link.segments.push({x:aC2.x-ARROW_DIS,y:aC2.y});
                  }
                  else if(link.anchorTo==1){
                      // 上邊節點入
                      let x3=x1;
                      let y3=y1-ARROW_DIS;
                      let x4=x2;
                      let y4=y2-ARROW_DIS;
                      if(x3<=x4 && y3>=y4){
                          //第一象限
                          link.segments.push({x:x3,y:y4});
                      }
                      else if(x3>x4 && y3>y4){
                          //第二象限
                          link.segments.push({x:x3,y:y4});
                      }
                      else if(x3>=x4 && y3<=y4){
                          //第三象限
                          link.segments.push({x:x4,y:y3});
                      }
                      else{
                          //第四象限
                          link.segments.push({x:x4,y:y3});
                      }
                      link.segments.push({x:aC2.x,y:aC2.y-ARROW_DIS});
                  }
                  else if(link.anchorTo==2){
                      // 右邊節點入
                      let x3=x1;
                      let y3=y1-ARROW_DIS;
                      let x4=x2+ARROW_DIS;
                      let y4=y2;
                      if(x3<=x4 && y3>=y4){
                          //第一象限
                          link.segments.push({x:x4,y:y3});
                      }
                      else if(x3>x4 && y3>y4){
                          //第二象限
                          link.segments.push({x:x3,y:y4});
                      }
                      else if(x3>=x4 && y3<=y4){
                          //第三象限
                          link.segments.push({x:x4,y:y3});
                      }
                      else{
                          //第四象限
                          link.segments.push({x:x4,y:y3});
                      }
                      link.segments.push({x:aC2.x+ARROW_DIS,y:aC2.y});
                  }
                  else if(link.anchorTo==3){
                      // 下邊節點入
                      let x3=x1;
                      let y3=y1-ARROW_DIS;
                      let x4=x2;
                      let y4=y2+ARROW_DIS;
                      if(x3<=x4 && y3>=y4){
                          //第一象限
                          link.segments.push({x:x4,y:y3});
                      }
                      else if(x3>x4 && y3>y4){
                          //第二象限
                          link.segments.push({x:x4,y:y3});
                      }
                      else if(x3>=x4 && y3<=y4){
                          //第三象限
                          link.segments.push({x:(x3+x4)/2,y:y3});
                          link.segments.push({x:(x3+x4)/2,y:y4});
                      }
                      else{
                          //第四象限
                          link.segments.push({x:(x3+x4)/2,y:y3});
                          link.segments.push({x:(x3+x4)/2,y:y4});
                      }
                      link.segments.push({x:aC2.x,y:aC2.y+ARROW_DIS});
                  }
              }
              else if(link.anchorFrom==2){
                  // 右邊節點出
                  link.segments.push({x:aC1.x+ARROW_DIS,y:aC1.y});
                  if(link.anchorTo==0){
                      // 左邊節點入
                      let x3=x1+ARROW_DIS;
                      let y3=y1;
                      let x4=x2-ARROW_DIS;
                      let y4=y2;
                      if(x3<=x4 && y3>=y4){
                          //第一象限
                          link.segments.push({x:x3,y:y4});
                      }
                      else if(x3>x4 && y3>y4){
                          //第二象限
                          link.segments.push({x:x3,y:(y3+y4)/2});
                          link.segments.push({x:x4,y:(y3+y4)/2});
                      }
                      else if(x3>=x4 && y3<=y4){
                          //第三象限
                          link.segments.push({x:x3,y:(y3+y4)/2});
                          link.segments.push({x:x4,y:(y3+y4)/2});
                      }
                      else{
                          //第四象限
                          link.segments.push({x:x4,y:y3});
                      }

                      link.segments.push({x:aC2.x-ARROW_DIS,y:aC2.y});
                  }
                  else if(link.anchorTo==1){
                      // 上邊節點入
                      let x3=x1+ARROW_DIS;
                      let y3=y1;
                      let x4=x2;
                      let y4=y2-ARROW_DIS;
                      if(x3<=x4 && y3>=y4){
                          //第一象限
                          link.segments.push({x:x3,y:y4});
                      }
                      else if(x3>x4 && y3>y4){
                          //第二象限
                          link.segments.push({x:x3,y:y4});
                      }
                      else if(x3>=x4 && y3<=y4){
                          //第三象限
                          link.segments.push({x:x3,y:y4});
                      }
                      else{
                          //第四象限
                          link.segments.push({x:x4,y:y3});
                      }
                      link.segments.push({x:aC2.x,y:aC2.y-ARROW_DIS});
                  }
                  else if(link.anchorTo==2){
                      // 右邊節點入
                      let x3=x1+ARROW_DIS;
                      let y3=y1;
                      let x4=x2+ARROW_DIS;
                      let y4=y2;
                      if(x3<=x4 && y3>=y4){
                          //第一象限
                          link.segments.push({x:x4,y:y3});
                      }
                      else if(x3>x4 && y3>y4){
                          //第二象限
                          link.segments.push({x:x3,y:y4});
                      }
                      else if(x3>=x4 && y3<=y4){
                          //第三象限
                          link.segments.push({x:x3,y:y4});
                      }
                      else{
                          //第四象限
                          link.segments.push({x:x4,y:y3});
                      }
                      link.segments.push({x:aC2.x+ARROW_DIS,y:aC2.y});
                  }
                  else if(link.anchorTo==3){
                      // 下邊節點入
                      let x3=x1+ARROW_DIS;
                      let y3=y1;
                      let x4=x2;
                      let y4=y2+ARROW_DIS;
                      if(x3<=x4 && y3>=y4){
                          //第一象限
                          link.segments.push({x:x4,y:y3});
                      }
                      else if(x3>x4 && y3>y4){
                          //第二象限
                          link.segments.push({x:x3,y:y4});
                      }
                      else if(x3>=x4 && y3<=y4){
                          //第三象限
                          link.segments.push({x:x3,y:y4});
                      }
                      else{
                          //第四象限
                          link.segments.push({x:x3,y:y4});
                      }
                      link.segments.push({x:aC2.x,y:aC2.y+ARROW_DIS});
                  }
              }
              else if(link.anchorFrom==3){
                  // 下邊節點出
                  link.segments.push({x:aC1.x,y:aC1.y+ARROW_DIS});
                  if(link.anchorTo==0){
                      // 左邊節點入
                      let x3=x1;
                      let y3=y1+ARROW_DIS;
                      let x4=x2-ARROW_DIS;
                      let y4=y2;
                      if(x3<=x4 && y3>=y4){
                          //第一象限
                          link.segments.push({x:x4,y:y3});
                      }
                      else if(x3>x4 && y3>y4){
                          //第二象限
                          link.segments.push({x:x4,y:y3});
                      }
                      else if(x3>=x4 && y3<=y4){
                          //第三象限
                          link.segments.push({x:x4,y:y3});
                      }
                      else{
                          //第四象限
                          link.segments.push({x:x3,y:y4});
                      }
                      link.segments.push({x:aC2.x-ARROW_DIS,y:aC2.y});
                  }
                  else if(link.anchorTo==1){
                      // 上邊節點入
                      let x3=x1;
                      let y3=y1+ARROW_DIS;
                      let x4=x2;
                      let y4=y2-ARROW_DIS;
                      if(x3<=x4 && y3>=y4){
                          //第一象限
                          link.segments.push({x:(x3+x4)/2,y:y3});
                          link.segments.push({x:(x3+x4)/2,y:y4});
                      }
                      else if(x3>x4 && y3>y4){
                          //第二象限
                          link.segments.push({x:(x3+x4)/2,y:y3});
                          link.segments.push({x:(x3+x4)/2,y:y4});
                      }
                      else if(x3>=x4 && y3<=y4){
                          //第三象限
                          link.segments.push({x:x4,y:y3});
                      }
                      else{
                          //第四象限
                          link.segments.push({x:x4,y:y3});
                      }
                      link.segments.push({x:aC2.x,y:aC2.y-ARROW_DIS});
                  }
                  else if(link.anchorTo==2){
                      // 右邊節點入
                      let x3=x1;
                      let y3=y1+ARROW_DIS;
                      let x4=x2+ARROW_DIS;
                      let y4=y2;
                      if(x3<=x4 && y3>=y4){
                          //第一象限
                          link.segments.push({x:x4,y:y3});
                      }
                      else if(x3>x4 && y3>y4){
                          //第二象限
                          link.segments.push({x:x4,y:y3});
                      }
                      else if(x3>=x4 && y3<=y4){
                          //第三象限
                          link.segments.push({x:x3,y:y4});
                      }
                      else{
                          //第四象限
                          link.segments.push({x:x4,y:y3});
                      }
                      link.segments.push({x:aC2.x+ARROW_DIS,y:aC2.y});
                  }
                  else if(link.anchorTo==3){
                      // 下邊節點入
                      let x3=x1;
                      let y3=y1+ARROW_DIS;
                      let x4=x2;
                      let y4=y2+ARROW_DIS;
                      if(x3<=x4 && y3>=y4){
                          //第一象限
                          link.segments.push({x:x4,y:y3});
                      }
                      else if(x3>x4 && y3>y4){
                          //第二象限
                          link.segments.push({x:x4,y:y3});
                      }
                      else if(x3>=x4 && y3<=y4){
                          //第三象限
                          link.segments.push({x:x3,y:y4});
                      }
                      else{
                          //第四象限
                          link.segments.push({x:x3,y:y4});
                      }
                      link.segments.push({x:aC2.x,y:aC2.y+ARROW_DIS});
                  }
              }
              link.segments.push({x:aC2.x,y:aC2.y});
              for(let i=2; i<link.segments.length-1; i++){
                  if(link.segments[i].x==aC1.x||link.segments[i-1].x==aC2.x||link.segments[i].y==aC1.y||link.segments[i-1].y==aC2.y){
                      continue;
                  }
                  if(link.segments[i-1].x == link.segments[i].x){
                      link.anchors.push(new Anchor( (link.segments[i-1].x+link.segments[i].x)/2, (link.segments[i-1].y+link.segments[i].y)/2 , "w-resize") )
                      link.new_anchors.push(new Anchor( (link.segments[i-1].x+link.segments[i].x)/2, (link.segments[i-1].y+link.segments[i].y)/2 , "w-resize") )
                  }
                  else if(link.segments[i-1].y+link.segments[i].y){
                      link.anchors.push(new Anchor( (link.segments[i-1].x+link.segments[i].x)/2, (link.segments[i-1].y+link.segments[i].y)/2 , "n-resize") )
                      link.new_anchors.push(new Anchor( (link.segments[i-1].x+link.segments[i].x)/2, (link.segments[i-1].y+link.segments[i].y)/2 , "n-resize") )
                  }
              }
              
              link.indexText=Math.floor(link.segments.length/2);
              return;
          }
          else if (link.mode=="square")
          {
              // console.log(link.anchors)
              link.new_anchors=[];
              const ARROW_DIS = 0;
              x1=aC1.x;
              x2=aC2.x;
              y1=aC1.y;
              y2=aC2.y;
              // console.log(link.anchorFrom)
              if(link.anchorFrom==0){
                  // 左邊節點出
                  link.segments.push({x:aC1.x-ARROW_DIS,y:aC1.y});
                  if(link.anchorTo==0){
                      // 左邊節點入
                      let x3=x1-ARROW_DIS;
                      let y3=y1;
                      let x4=x2-ARROW_DIS;
                      let y4=y2;
                      if(x3<=x4 && y3>=y4){
                          //第一象限
                          link.segments.push({x:link.anchors[0].x,y:y3});
                          link.segments.push({x:link.anchors[0].x,y:y4});
                      }
                      else if(x3>x4 && y3>y4){
                          //第二象限
                          link.segments.push({x:link.anchors[0].x,y:y3});
                          link.segments.push({x:link.anchors[0].x,y:y4});
                      }
                      else if(x3>=x4 && y3<=y4){
                          //第三象限
                          link.segments.push({x:link.anchors[0].x,y:y3});
                          link.segments.push({x:link.anchors[0].x,y:y4});
                      }
                      else{
                          //第四象限
                          link.segments.push({x:link.anchors[0].x,y:y3});
                          link.segments.push({x:link.anchors[0].x,y:y4});
                      }

                  }
                  else if(link.anchorTo==1){
                      // 上邊節點入
                      let x3=x1-ARROW_DIS;
                      let y3=y1;
                      let x4=x2;
                      let y4=y2-ARROW_DIS;
                      if(x3<=x4 && y3>=y4){
                          //第一象限
                          link.segments.push({x:link.anchors[0].x,y:y3});
                          link.segments.push({x:link.anchors[0].x,y:link.anchors[1].y});
                          link.segments.push({x:x4,y:link.anchors[1].y});
                      }
                      else if(x3>x4 && y3>y4){
                          //第二象限
                          link.segments.push({x:link.anchors[0].x,y:y3});
                          link.segments.push({x:link.anchors[0].x,y:link.anchors[1].y});
                          link.segments.push({x:x4,y:link.anchors[1].y});
                      }
                      else if(x3>=x4 && y3<=y4){
                          //第三象限
                          link.segments.push({x:x4,y:y3});
                      }
                      else{
                          //第四象限
                          link.segments.push({x:link.anchors[0].x,y:y3});
                          link.segments.push({x:link.anchors[0].x,y:link.anchors[1].y});
                          link.segments.push({x:x4,y:link.anchors[1].y});
                      }
                  }
                  else if(link.anchorTo==2){
                      // 右邊節點入
                      let x3=x1-ARROW_DIS;
                      let y3=y1;
                      let x4=x2+ARROW_DIS;
                      let y4=y2;
                      if(x3<=x4 && y3>=y4){
                          //第一象限
                          link.segments.push({x:link.anchors[0].x,y:y3});
                          link.segments.push({x:link.anchors[0].x,y:link.anchors[1].y});
                          link.segments.push({x:link.anchors[2].x,y:link.anchors[1].y});
                          link.segments.push({x:link.anchors[2].x,y:y4});
                      }
                      else if(x3>x4 && y3>y4){
                          //第二象限
                          link.segments.push({x:link.anchors[0].x,y:y3});
                          link.segments.push({x:link.anchors[0].x,y:y4});
                      }
                      else if(x3>=x4 && y3<=y4){
                          //第三象限
                          link.segments.push({x:link.anchors[0].x,y:y3});
                          link.segments.push({x:link.anchors[0].x,y:y4});
                      }
                      else{
                          //第四象限
                          link.segments.push({x:link.anchors[0].x,y:y3});
                          link.segments.push({x:link.anchors[0].x,y:link.anchors[1].y});
                          link.segments.push({x:link.anchors[2].x,y:link.anchors[1].y});
                          link.segments.push({x:link.anchors[2].x,y:y4});
                      }
                  }
                  else if(link.anchorTo==3){
                      // 下邊節點入
                      let x3=x1-ARROW_DIS;
                      let y3=y1;
                      let x4=x2;
                      let y4=y2+ARROW_DIS;
                      if(x3<=x4 && y3>=y4){
                          //第一象限
                          link.segments.push({x:link.anchors[0].x,y:y3});
                          link.segments.push({x:link.anchors[0].x,y:link.anchors[1].y});
                          link.segments.push({x:x4,y:link.anchors[1].y});
                      }
                      else if(x3>x4 && y3>y4){
                          //第二象限
                          link.segments.push({x:x4,y:y3});
                      }
                      else if(x3>=x4 && y3<=y4){
                          //第三象限
                          link.segments.push({x:link.anchors[0].x,y:y3});
                          link.segments.push({x:link.anchors[0].x,y:link.anchors[1].y});
                          link.segments.push({x:x4,y:link.anchors[1].y});
                      }
                      else{
                          //第四象限
                          link.segments.push({x:link.anchors[0].x,y:y3});
                          link.segments.push({x:link.anchors[0].x,y:link.anchors[1].y});
                          link.segments.push({x:x4,y:link.anchors[1].y});
                      }
                  }
              }
              else if(link.anchorFrom==1){
                  // 上邊節點出
                  link.segments.push({x:aC1.x,y:aC1.y-ARROW_DIS});
                  if(link.anchorTo==0){
                      // 左邊節點入
                      let x3=x1;
                      let y3=y1-ARROW_DIS;
                      let x4=x2-ARROW_DIS;
                      let y4=y2;
                      if(x3<=x4 && y3>=y4){
                          //第一象限
                          link.segments.push({x:link.anchors[0].x,y:y3});
                          link.segments.push({x:link.anchors[0].x,y:y4});
                      }
                      else if(x3>x4 && y3>y4){
                          //第二象限
                          link.segments.push({x:x3,y:link.anchors[0].y});
                          link.segments.push({x:link.anchors[1].x,y:link.anchors[0].y});
                          link.segments.push({x:link.anchors[1].x,y:y4});
                      }
                      else if(x3>=x4 && y3<=y4){
                          //第三象限
                          link.segments.push({x:x3,y:link.anchors[0].y});
                          link.segments.push({x:link.anchors[1].x,y:link.anchors[0].y});
                          link.segments.push({x:link.anchors[1].x,y:y4});
                      }
                      else{
                          //第四象限
                          link.segments.push({x:x3,y:link.anchors[0].y});
                          link.segments.push({x:link.anchors[1].x,y:link.anchors[0].y});
                          link.segments.push({x:link.anchors[1].x,y:y4});
                      }

                  }
                  else if(link.anchorTo==1){
                      // 上邊節點入
                      let x3=x1;
                      let y3=y1-ARROW_DIS;
                      let x4=x2;
                      let y4=y2-ARROW_DIS;
                      link.segments.push({x:x3,y:link.anchors[0].y});
                      link.segments.push({x:x4,y:link.anchors[0].y});
                  }
                  else if(link.anchorTo==2){
                      // 右邊節點入
                      let x3=x1;
                      let y3=y1-ARROW_DIS;
                      let x4=x2+ARROW_DIS;
                      let y4=y2;
                      if(x3<=x4 && y3>=y4){
                          //第一象限
                          link.segments.push({x:x3,y:link.anchors[0].y});
                          link.segments.push({x:link.anchors[1].x,y:link.anchors[0].y});
                          link.segments.push({x:link.anchors[1].x,y:y4});
                      }
                      else if(x3>x4 && y3>y4){
                          //第二象限
                          link.segments.push({x:x3,y:y4});
                      }
                      else if(x3>=x4 && y3<=y4){
                          //第三象限
                          link.segments.push({x:x3,y:link.anchors[0].y});
                          link.segments.push({x:link.anchors[1].x,y:link.anchors[0].y});
                          link.segments.push({x:link.anchors[1].x,y:y4});
                      }
                      else{
                          //第四象限
                          link.segments.push({x:x3,y:link.anchors[0].y});
                          link.segments.push({x:link.anchors[1].x,y:link.anchors[0].y});
                          link.segments.push({x:link.anchors[1].x,y:y4});
                      }
                  }
                  else if(link.anchorTo==3){
                      // 下邊節點入
                      let x3=x1;
                      let y3=y1-ARROW_DIS;
                      let x4=x2;
                      let y4=y2+ARROW_DIS;
                      if(x3<=x4 && y3>=y4){
                          //第一象限
                          link.segments.push({x:x3,y:link.anchors[0].y});
                          link.segments.push({x:x4,y:link.anchors[0].y});
                      }
                      else if(x3>x4 && y3>y4){
                          //第二象限
                          link.segments.push({x:x3,y:link.anchors[0].y});
                          link.segments.push({x:x4,y:link.anchors[0].y});
                      }
                      else if(x3>=x4 && y3<=y4){
                          //第三象限
                          link.segments.push({x:x3,y:link.anchors[0].y});
                          link.segments.push({x:link.anchors[1].x,y:link.anchors[0].y});
                          link.segments.push({x:link.anchors[1].x,y:link.anchors[2].y});
                          link.segments.push({x:x4,y:link.anchors[2].y});
                      }
                      else{
                          //第四象限
                          link.segments.push({x:x3,y:link.anchors[0].y});
                          link.segments.push({x:link.anchors[1].x,y:link.anchors[0].y});
                          link.segments.push({x:link.anchors[1].x,y:link.anchors[2].y});
                          link.segments.push({x:x4,y:link.anchors[2].y});
                      }
                  }
              }
              else if(link.anchorFrom==2){
                  // 右邊節點出
                  link.segments.push({x:aC1.x+ARROW_DIS,y:aC1.y});
                  if(link.anchorTo==0){
                      // 左邊節點入
                      let x3=x1+ARROW_DIS;
                      let y3=y1;
                      let x4=x2-ARROW_DIS;
                      let y4=y2;
                      if(x3<=x4 && y3>=y4){
                          //第一象限
                          link.segments.push({x:link.anchors[0].x,y:y3});
                          link.segments.push({x:link.anchors[0].x,y:y4});
                      }
                      else if(x3>x4 && y3>y4){
                          //第二象限
                          link.segments.push({x:link.anchors[0].x,y:y3});
                          link.segments.push({x:link.anchors[0].x,y:link.anchors[1].y});
                          link.segments.push({x:link.anchors[2].x,y:link.anchors[1].y});
                          link.segments.push({x:link.anchors[2].x,y:y4});
                      }
                      else if(x3>=x4 && y3<=y4){
                          //第三象限
                          link.segments.push({x:link.anchors[0].x,y:y3});
                          link.segments.push({x:link.anchors[0].x,y:link.anchors[1].y});
                          link.segments.push({x:link.anchors[2].x,y:link.anchors[1].y});
                          link.segments.push({x:link.anchors[2].x,y:y4});
                      }
                      else{
                          //第四象限
                          link.segments.push({x:link.anchors[0].x,y:y3});
                          link.segments.push({x:link.anchors[0].x,y:y4});
                      }

                  }
                  else if(link.anchorTo==1){
                      // 上邊節點入
                      let x3=x1+ARROW_DIS;
                      let y3=y1;
                      let x4=x2;
                      let y4=y2-ARROW_DIS;
                      if(x3<=x4 && y3>=y4){
                          //第一象限
                          link.segments.push({x:link.anchors[0].x,y:y3});
                          link.segments.push({x:link.anchors[0].x,y:link.anchors[1].y});
                          link.segments.push({x:x4,y:link.anchors[1].y});
                      }
                      else if(x3>x4 && y3>y4){
                          //第二象限
                          link.segments.push({x:link.anchors[0].x,y:y3});
                          link.segments.push({x:link.anchors[0].x,y:link.anchors[1].y});
                          link.segments.push({x:x4,y:link.anchors[1].y});
                      }
                      else if(x3>=x4 && y3<=y4){
                          //第三象限
                          link.segments.push({x:link.anchors[0].x,y:y3});
                          link.segments.push({x:link.anchors[0].x,y:link.anchors[1].y});
                          link.segments.push({x:x4,y:link.anchors[1].y});
                      }
                      else{
                          //第四象限
                          link.segments.push({x:link.anchors[0].x,y:y3});
                          link.segments.push({x:link.anchors[0].x,y:link.anchors[1].y});
                          link.segments.push({x:x4,y:link.anchors[1].y});
                      }
                  }
                  else if(link.anchorTo==2){
                      // 右邊節點入
                      let x3=x1+ARROW_DIS;
                      let y3=y1;
                      let x4=x2+ARROW_DIS;
                      let y4=y2;
                      if(x3<=x4 && y3>=y4){
                          //第一象限
                          link.segments.push({x:link.anchors[0].x,y:y3});
                          link.segments.push({x:link.anchors[0].x,y:y4});
                      }
                      else if(x3>x4 && y3>y4){
                          //第二象限
                          link.segments.push({x:link.anchors[0].x,y:y3});
                          link.segments.push({x:link.anchors[0].x,y:y4});
                      }
                      else if(x3>=x4 && y3<=y4){
                          //第三象限
                          link.segments.push({x:link.anchors[0].x,y:y3});
                          link.segments.push({x:link.anchors[0].x,y:y4});
                      }
                      else{
                          //第四象限
                          link.segments.push({x:link.anchors[0].x,y:y3});
                          link.segments.push({x:link.anchors[0].x,y:y4});
                      }
                  }
                  else if(link.anchorTo==3){
                      // 下邊節點入
                      let x3=x1+ARROW_DIS;
                      let y3=y1;
                      let x4=x2;
                      let y4=y2+ARROW_DIS;
                      if(x3<=x4 && y3>=y4){
                          //第一象限
                          link.segments.push({x:x4,y:y3});
                      }
                      else if(x3>x4 && y3>y4){
                          //第二象限
                          link.segments.push({x:link.anchors[0].x,y:y3});
                          link.segments.push({x:link.anchors[0].x,y:link.anchors[1].y});
                          link.segments.push({x:x4,y:link.anchors[1].y});
                      }
                      else if(x3>=x4 && y3<=y4){
                          //第三象限
                          link.segments.push({x:link.anchors[0].x,y:y3});
                          link.segments.push({x:link.anchors[0].x,y:link.anchors[1].y});
                          link.segments.push({x:x4,y:link.anchors[1].y});
                      }
                      else{
                          //第四象限
                          link.segments.push({x:link.anchors[0].x,y:y3});
                          link.segments.push({x:link.anchors[0].x,y:link.anchors[1].y});
                          link.segments.push({x:x4,y:link.anchors[1].y});
                      }
                  }
              }
              else if(link.anchorFrom==3){
                  // 下邊節點出
                  link.segments.push({x:aC1.x,y:aC1.y+ARROW_DIS});
                  if(link.anchorTo==0){
                      // 左邊節點入
                      let x3=x1;
                      let y3=y1+ARROW_DIS;
                      let x4=x2-ARROW_DIS;
                      let y4=y2;
                      if(x3<=x4 && y3>=y4){
                          //第一象限
                          link.segments.push({x:x3,y:link.anchors[0].y});
                          link.segments.push({x:link.anchors[1].x,y:link.anchors[0].y});
                          link.segments.push({x:link.anchors[1].x,y:y4});
                      }
                      else if(x3>x4 && y3>y4){
                          //第二象限
                          link.segments.push({x:x3,y:link.anchors[0].y});
                          link.segments.push({x:link.anchors[1].x,y:link.anchors[0].y});
                          link.segments.push({x:link.anchors[1].x,y:y4});
                      }
                      else if(x3>=x4 && y3<=y4){
                          //第三象限
                          link.segments.push({x:x3,y:link.anchors[0].y});
                          link.segments.push({x:link.anchors[1].x,y:link.anchors[0].y});
                          link.segments.push({x:link.anchors[1].x,y:y4});
                      }
                      else{
                          //第四象限
                          link.segments.push({x:x3,y:y4});
                      }
                  }
                  else if(link.anchorTo==1){
                      // 上邊節點入
                      let x3=x1;
                      let y3=y1+ARROW_DIS;
                      let x4=x2;
                      let y4=y2-ARROW_DIS;
                      if(x3<=x4 && y3>=y4){
                          //第一象限
                          link.segments.push({x:x3,y:link.anchors[0].y});
                          link.segments.push({x:link.anchors[1].x,y:link.anchors[0].y});
                          link.segments.push({x:link.anchors[1].x,y:link.anchors[2].y});
                          link.segments.push({x:x4,y:link.anchors[2].y});
                      }
                      else if(x3>x4 && y3>y4){
                          //第二象限
                          link.segments.push({x:x3,y:link.anchors[0].y});
                          link.segments.push({x:link.anchors[1].x,y:link.anchors[0].y});
                          link.segments.push({x:link.anchors[1].x,y:link.anchors[2].y});
                          link.segments.push({x:x4,y:link.anchors[2].y});
                      }
                      else if(x3>=x4 && y3<=y4){
                          //第三象限
                          link.segments.push({x:x3,y:link.anchors[0].y});
                          link.segments.push({x:x4,y:link.anchors[0].y});
                      }
                      else{
                          //第四象限
                          link.segments.push({x:x3,y:link.anchors[0].y});
                          link.segments.push({x:x4,y:link.anchors[0].y});
                      }
                  }
                  else if(link.anchorTo==2){
                      // 右邊節點入
                      let x3=x1;
                      let y3=y1+ARROW_DIS;
                      let x4=x2+ARROW_DIS;
                      let y4=y2;
                      if(x3<=x4 && y3>=y4){
                          //第一象限
                          link.segments.push({x:x3,y:link.anchors[0].y});
                          link.segments.push({x:link.anchors[1].x,y:link.anchors[0].y});
                          link.segments.push({x:link.anchors[1].x,y:y4});
                      }
                      else if(x3>x4 && y3>y4){
                          //第二象限
                          link.segments.push({x:x3,y:link.anchors[0].y});
                          link.segments.push({x:link.anchors[1].x,y:link.anchors[0].y});
                          link.segments.push({x:link.anchors[1].x,y:y4});
                      }
                      else if(x3>=x4 && y3<=y4){
                          //第三象限
                          link.segments.push({x:x3,y:y4});
                      }
                      else{
                          //第四象限
                          link.segments.push({x:x3,y:link.anchors[0].y});
                          link.segments.push({x:link.anchors[1].x,y:link.anchors[0].y});
                          link.segments.push({x:link.anchors[1].x,y:y4});
                      }
                  }
                  else if(link.anchorTo==3){
                      // 下邊節點入
                      let x3=x1;
                      let y3=y1+ARROW_DIS;
                      let x4=x2;
                      let y4=y2+ARROW_DIS;
                      link.segments.push({x:x3,y:link.anchors[0].y});
                      link.segments.push({x:x4,y:link.anchors[0].y});
                  }
              }
              link.segments.push({x:aC2.x,y:aC2.y});
              let ind = 0;
              for(let i=2; i<link.segments.length-1; i++){
                  if(link.segments[i].x==aC1.x||link.segments[i-1].x==aC2.x||link.segments[i].y==aC1.y||link.segments[i-1].y==aC2.y){
                      continue;
                  }
                  if(link.segments[i-1].x == link.segments[i].x){
                      link.new_anchors.push(new Anchor( (link.segments[i-1].x+link.segments[i].x)/2, (link.segments[i-1].y+link.segments[i].y)/2 , "w-resize") )
                      link.anchors[ind].x = (link.segments[i-1].x+link.segments[i].x)/2
                      link.anchors[ind].y = (link.segments[i-1].y+link.segments[i].y)/2 
                      ind++;
                  }
                  else if(link.segments[i-1].y+link.segments[i].y){
                      link.new_anchors.push(new Anchor( (link.segments[i-1].x+link.segments[i].x)/2, (link.segments[i-1].y+link.segments[i].y)/2 , "n-resize") )
                      link.anchors[ind].x = (link.segments[i-1].x+link.segments[i].x)/2
                      link.anchors[ind].y = (link.segments[i-1].y+link.segments[i].y)/2    
                      ind++;                     
                  }
              }
              link.indexText=Math.floor(link.segments.length/2);
              return;
          }
          else
          {
          }
          
      }

      //LINKTEXT POSITION
      let element0 = link.segments[0];
      let maxD=0;
      link.indexText=1;
      for (let index = 1; index < link.segments.length; index++) {
          const element = link.segments[index];
          let d=Math.abs(element.x-element0.x)+Math.abs(element.y-element0.y);
          if (d>maxD){
              maxD=d;
              link.indexText=index;
          }
          element0=element;
      }

}

const DIAGRAMFLOW_ARROW_SIZE=15;
var model={
    ctx:null,
    nodes:[],
    links:[],
    myCanvas:null,
    rough:false,
    size:1,
	copyNode: null,
    addNode:function(node){
        this.nodes.push(node);
    },
    addLink:function(link){
		for(let i= 0; i < this.links.length; i++){
			if(this.links[i]==null) continue;
    		if(this.links[i].from == link.from && this.links[i].to == link.to 
			&& this.links[i].anchorIndexFrom == link.anchorIndexFrom && this.links[i].anchorIndexTo == link.anchorIndexTo){
    			console.log("There is already a link here!");
    			return;
    		}
    	}
		if(model.nodes[link.from].figure=="For_Loop"){
			let node_info=document.querySelector("#node_info");
			document.getElementById("node_info").innerHTML = node_model["link_for"];
			node_info.showModal();
			// Get the input field

			let hint_yes=document.querySelector("#hint_yes");
			let hint_no=document.querySelector("#hint_no");
			hint_yes.addEventListener("click", function(){
				link.text = $("input[name='radio']:checked").val();
				model.links.push(link);
				model.draw();
				node_info.close();
			})

			hint_no.addEventListener("click", function(){
				node_info.close();
			})
		}
		else if(model.nodes[link.from].figure=="Diamond" || model.nodes[link.from].figure=="While_Loop"){
			let node_info=document.querySelector("#node_info");
			document.getElementById("node_info").innerHTML = node_model["link_tf"];
			node_info.showModal();
			// Get the input field

			let hint_yes=document.querySelector("#hint_yes");
			let hint_no=document.querySelector("#hint_no");
			hint_yes.addEventListener("click", function(){
				link.text = $("input[name='radio']:checked").val();
				model.links.push(link);
				model.draw();
				node_info.close();
			})

			hint_no.addEventListener("click", function(){
				node_info.close();
			})
		}
		else{
			model.links.push(link);
		}
        
    },

    clean:function(){
        this.ctx.beginPath();

        var grd = this.ctx.createLinearGradient(0, this.myCanvas.height, this.myCanvas.width, 0);
        grd.addColorStop(0, "#eeeeee");
        grd.addColorStop(1, "white");

        // Fill with gradient
        this.ctx.fillStyle = grd;
        this.ctx.fillRect(0, 0, this.myCanvas.width, this.myCanvas.height);
        this.ctx.stroke();
    },

    clear:function(){
        this.nodes=[];
        this.links=[];
        mouse.clear();
    },

    draw:function(){
        this.clean();
        for (let index = 0; index < this.nodes.length; index++) {
			if(this.nodes[index])
				this.nodes[index].draw(this.ctx);
        }

        for (let index = 0; index < this.links.length; index++) {
			if(this.links[index])
				this.links[index].draw(this.ctx);
        }
        if (mouse.selNode!=null && this.nodes[mouse.selNode] != null){
            this.nodes[mouse.selNode].highlight(this.ctx);
        }
        if(step_list.step.length!=0){
            model.nodes[step_list.step[current_step]].stepHighlight(model.ctx);
        }
    },
    init:function(canvasName){
        this.myCanvas=document.getElementById(canvasName);
        this.myCanvasContainer=document.getElementById(canvasName).parentElement;
        this.ctx=this.myCanvas.getContext("2d");
        this.myCanvas.addEventListener("mousedown",mouse.down)
        this.myCanvas.addEventListener("mousemove",mouse.move)
        this.myCanvas.addEventListener("mouseup",mouse.up)
        this.myCanvas.addEventListener("dblclick",mouse.dblclick)
        this.myCanvas.addEventListener("wheel",mouse.wheel)
        document.addEventListener("keydown",mouse.keydown)
        this.myCanvas.ondragstart = function() { return false; };
        this.myCanvas.width=this.myCanvasContainer.clientWidth;
        this.myCanvas.height=this.myCanvasContainer.clientHeight;

        window.addEventListener("resize",function(){
            model.myCanvas.width=model.myCanvasContainer.clientWidth;
            model.myCanvas.height=model.myCanvasContainer.clientHeight;
            model.draw();
        });

    },

    findNode:function(mouseC){
        var minArea=34435345345344;
        var selIndex=null;
        for (let index = 0; index < this.nodes.length; index++) {
			if(this.nodes[index]==null) continue;
            if (this.nodes[index].isInside(mouseC.x,mouseC.y))
            {
                var calcArea=this.nodes[index].w*this.nodes[index].h;
                if (calcArea<minArea)
                {
                    selIndex=index;
                    minArea=calcArea;
                }
            }
        }
        return selIndex;
    },

    copyFrom:function(sourceModel){
        model.nodes=[];
        if (sourceModel.nodes){
            for (let index = 0; index < sourceModel.nodes.length; index++) {
                const element = sourceModel.nodes[index];
                var anchors=[];
                element.anchors.forEach(a => {
                    anchors.push(new model.anchor(a.x,a.y,a.cursorClass));
                });
                model.addNode(new model.node(element.x,element.y,element.w,element.h,anchors,element.text,element.fillStyle, element.figure, element.data));
            }
        }
        model.links=[];
        if (sourceModel.links){
            for (let index = 0; index < sourceModel.links.length; index++) {
                const element = sourceModel.links[index];
				if(element==null) continue;
                model.addLink(new model.link(element.from,element.to, element.anchorFrom,element.anchorTo, element.text));
            }
        }
        mouse.selNode=null;
        mouse.dragging=null;
    },

    selectNode:function(node){
        mouse.selNode=node;
        model.draw();
    },
    connector:function(x,y,mode,title,decoration,options){
        this.x=x;
        this.y=y;
        this.mode=mode;
        if (options)
            this.options=options;
        else
            this.options={dropAllowed:true, dragAllowed:true,radius:7};
        this.title=title;
        this.decoration={};
        if (decoration){
            if (decoration.fillStyle==null)
                this.decoration.fillStyle="black";
            else
                this.decoration.fillStyle=decoration.fillStyle;
            if (decoration.strokeStyle==null)
                this.decoration.strokeStyle="black";
            else
                this.decoration.strokeStyle=decoration.strokeStyle;
            if (decoration.highlightStrokeStyle==null)
                this.decoration.highlightStrokeStyle="black";
            else
                this.decoration.highlightStrokeStyle=decoration.highlightStrokeStyle;
            if (decoration.highlightText==null)
                this.decoration.highlightText="black";
            else
                this.decoration.highlightText=decoration.highlightText;
        }
        this.draw=function(ctx,originX,originY,width,height){
            ctx.beginPath();
            ctx.lineWidth=1;
            ctx.fillStyle=this.decoration.fillStyle;
            ctx.strokeStyle = this.decoration.strokeStyle;
            ctx.arc(this.x*width+originX,this.y*height+originY,connector_r,0,2*Math.PI,false);
            ctx.fill();
            ctx.stroke();
        }
        this.highlight=function(ctx,originX,originY,width,height){
            ctx.beginPath();
            ctx.lineWidth=2;
            ctx.strokeStyle = this.decoration.highlightStrokeStyle;
            var oX=this.x*width+originX;
            var oY=this.y*height+originY;
            ctx.arc(oX,oY,connector_r,0,2*Math.PI,false);
            ctx.stroke();
            if (this.title!=null)
            {
                ctx.fillStyle = this.decoration.highlightText;
                ctx.textAlign = "center";
                ctx.textBaseline = "top";
                ctx.fillText(this.title,oX,oY+connector_r);
            }
        }
        this.distance=function(x,y,originX,originY,width,height)
        {
            return (x-this.x*width-originX)*(x-this.x*width-originX) + (y-this.y*height-originY)*(y-this.y*height-originY);
        }
        this.isInside=function(x,y,originX,originY,width,height){
            var d=this.distance(x,y,originX,originY,width,height);
            if (d<=connector_r*connector_r){
                return true;
            }
            else
                return false;
        };
    },
    anchor:function(x,y,cursorClass)
    {
        this.x=x;
        this.y=y;
        this.radius=5;
        this.cursorClass=cursorClass;
        this.strokeStyle="gray";
        this.strokeStyleHighlight="red";
        this.dragOrigin={};

        this.draw=function(ctx,originX,originY,width,height){
            ctx.beginPath();
            ctx.strokeStyle = this.strokeStyle;
            ctx.lineWidth=1;
            ctx.rect(x*width+originX-this.radius,y*height+originY-this.radius,this.radius*2,this.radius*2);
            ctx.stroke();
        }
        this.highlight=function(ctx,originX,originY,width,height){
            ctx.beginPath();
            ctx.strokeStyle = this.strokeStyleHighlight;
            var r=this.radius*1.5;
            ctx.rect(x*width+originX-r,y*height+originY-r,r*2,r*2);
            ctx.stroke();
        }
        this.distance=function(x,y,originX,originY,width,height)
        {
            return (x-this.x*width-originX)*(x-this.x*width-originX) + (y-this.y*height-originY)*(y-this.y*height-originY);
        }
        this.isInside=function(x,y,originX,originY,width,height){
            var d=this.distance(x,y,originX,originY,width,height);
            if (d<=this.radius*this.radius){
                return true;
            }
            else
                return false;
        };
    },
    node:function(x,y,w,h,connectors,text,fillStyle,figure,v,args)
    {
        this.textfill=function(ctx) {
            var fontSize   =  20;
            var lines      =  new Array();
            var width = 0, i, j;
            var result;
            var color = this.strokeStyle || "white";
            var text=this.text;
            var max_width=this.w;
			

            // Font and size is required for ctx.measureText()
            ctx.textAlign = "left";
            ctx.font   = fontSize + "px Arial";

            ctx.textBaseline = 'middle';
            ctx.textAlign="center";
            // Start calculation
            while ( text.length ) {
                for( i=text.length; ctx.measureText(text.substr(0,i)).width > max_width-14; i-- );
            
                result = text.substr(0,i);
            
                if ( i !== text.length )
                    for( j=0; result.indexOf(" ",j) !== -1; j=result.indexOf(" ",j)+1 );
                
                lines.push( result.substr(0, j|| result.length) );
                width = Math.max( width, ctx.measureText(lines[ lines.length-1 ]).width );
                text  = text.substr( lines[ lines.length-1 ].length, text.length );
            }
            
            ctx.font   = fontSize + "px Arial";

            // Render
            ctx.fillStyle = color;
            var vOffSet=(this.h-(lines.length+1)*(fontSize+5))/2-5;
            for ( i=0, j=lines.length; i<j; ++i ) {
                ctx.fillText( lines[i], this.x+ this.w/2 , this.y  + fontSize + (fontSize+5) * i + vOffSet );
            }
        }

        this.x=Number(x);
        this.y=Number(y);
        this.w=Number(w);
        this.h=Number(h);
        this.data=args;
        this.connectors=connectors;
        this.anchors=[
            new model.anchor(0,0,"nw-resize"),
            new model.anchor(1,0,"ne-resize"),
            new model.anchor(1,1,"se-resize"), 
            new model.anchor(0,1,"sw-resize"),
        ];
        this.strokeStyle="black";
        this.strokeStyleHighlight="red";
        this.fillStyle=fillStyle;
        this.text=text;
        this.figure=figure;
		this.variables = v;
        // this.linkNum = 0;
        this.draw=function(ctx){
            if (typeof (this.figure)==="undefined" || typeof (this.figure)==="function"){
                this.figure="Rectangle";
            }
            else
                Figures[this.figure](ctx,this,this.strokeStyle);
            if (this.connectors!=null)
            {
                this.connectors.forEach(connector=>{
                    connector.draw(ctx,this.x,this.y,this.w,this.h);
                });
            }
        };
        this.connectorCoords=function(connectorIndex){
            return {x:this.x+this.connectors[connectorIndex].x*this.w,
                    y:this.y+this.connectors[connectorIndex].y*this.h};
        }
        this.anchorCoords=function(anchorIndex){
            return {x:this.x+this.anchors[anchorIndex].x*this.w,y:this.y+this.anchors[anchorIndex].y*this.h};
        }
        this.isInside=function(x,y){
            if (x>=this.x && x<=this.x+this.w && y>=this.y && y<=this.y+this.h)
                return true;
            else
                return false;
        };
        this.isInsideConnectors=function(point){
            if (this.connectors)
                for (let index = 0; index < this.connectors.length; index++) {
                    const element = this.connectors[index];
                    if (element.isInside(point.x,point.y,this.x,this.y,this.w,this.h))
                    {
                        return index;
                    }
                }
            return null;
        };
        this.isInsideAnchors=function(x,y){
            for (let index = 0; index < this.anchors.length; index++) {
                const element = this.anchors[index];
                if (element.isInside(x,y,this.x,this.y,this.w,this.h))
                {
                    return index;
                }
            }
            return null;
        };
        this.nearestAnchor=function(mouseC){
            var dMin=999999;
            var sel=null;
            for (let index = 0; index < this.anchors.length; index++) {
                const element = this.anchors[index];
                var d=element.distance(mouseC.x,mouseC.y,this.x,this.y,this.w,this.h);
                if (d<dMin && element.cursorClass!="move")
                {
                    dMin=d;
                    sel=index;
                }
            }
            return sel;
        };
        this.highlight=function(ctx){
            this.anchors.forEach(element => {
                element.draw(ctx,this.x,this.y,this.w,this.h);
            });
        }
        this.stepHighlight=function(ctx){
            if (typeof (this.figure)==="undefined" || typeof (this.figure)==="function"){
                this.figure="Rectangle";
            }
            else
                Figures[this.figure](ctx,this,this.strokeStyleHighlight);
            if (this.connectors!=null)
            {
                this.connectors.forEach(connector=>{
                    connector.draw(ctx,this.x,this.y,this.w,this.h);
                });
            }
        }
    },
    link:function(from,to,anchorIndexFrom,anchorIndexTo,text,mode){
        this.directionToVector=function(cursorClass){
            switch (cursorClass) {
            case "w-resize":
                return {x:-1,y:0};
            case "e-resize":
                return {x:1,y:0};
            case "s-resize":
                return {x:0,y:1};
            case "n-resize":
                return {x:0,y:-1};
            case "ne-resize":
                return {x:1,y:-1};
            case "nw-resize":
                return {x:-1,y:-1};
            case "se-resize":
                return {x:1,y:1};
            case "sw-resize":
                return {x:-1,y:1};
            }
        }
    
        this.from=from;
        this.to=to;
        this.anchorFrom=anchorIndexFrom;
        this.anchorTo=anchorIndexTo;
        this.segments=[];
        this.strokeStyle="black";
        this.strokeStyleHighlight="red";
        this.indexText=0;
        this.text=text;
        this.anchors=[];
        this.new_anchors=[];
        if (mode!=null)
            this.mode=mode.toLowerCase();
        else
            this.mode="straight";
        
        // model.nodes[this.from].linkNum += 1;
    
        this.reSegment=function(){
            if (this.mode=="straight" || this.mode==null)
            {
                var aC1=model.nodes[this.from].connectorCoords(this.anchorFrom);
                var aC2=model.nodes[this.to].connectorCoords(this.anchorTo);
                this.segments=[{x:aC1.x,y:aC1.y},{x:aC2.x,y:aC2.y}];
                this.indexText=1;
            }
            else
            {
                this.segments=[];
                var aC1=model.nodes[this.from].connectorCoords(this.anchorFrom);
                var aC2=model.nodes[this.to].connectorCoords(this.anchorTo);

                this.segments.push({x:aC1.x,y:aC1.y});
                if (this.mode=="square" && (this.anchors.length==0 || this.anchors.length!=this.new_anchors.length) )
                {
                    this.anchors=[];
                    this.new_anchors=[];
                    const ARROW_DIS = 20;
                    var x1=aC1.x;
                    var x2=aC2.x;
                    var y1=aC1.y;
                    var y2=aC2.y;
                    // console.log(this.anchorFrom)
                    if(this.anchorFrom==0){
                        // 左邊節點出
                        this.segments.push({x:aC1.x-ARROW_DIS,y:aC1.y});
                        if(this.anchorTo==0){
                            // 左邊節點入
                            let x3=x1-ARROW_DIS;
                            let y3=y1;
                            let x4=x2-ARROW_DIS;
                            let y4=y2;
                            if(x3<=x4 && y3>=y4){
                                //第一象限
                                this.segments.push({x:x3,y:y4});
                            }
                            else if(x3>x4 && y3>y4){
                                //第二象限
                                this.segments.push({x:x4,y:y3});
                            }
                            else if(x3>=x4 && y3<=y4){
                                //第三象限
                                this.segments.push({x:x4,y:y3});
                            }
                            else{
                                //第四象限
                                this.segments.push({x:x3,y:y4});
                            }

                            this.segments.push({x:aC2.x-ARROW_DIS,y:aC2.y});
                        }
                        else if(this.anchorTo==1){
                            // 上邊節點入
                            let x3=x1-ARROW_DIS;
                            let y3=y1;
                            let x4=x2;
                            let y4=y2-ARROW_DIS;
                            if(x3<=x4 && y3>=y4){
                                //第一象限
                                this.segments.push({x:x3,y:y4});
                            }
                            else if(x3>x4 && y3>y4){
                                //第二象限
                                this.segments.push({x:x3,y:y4});
                            }
                            else if(x3>=x4 && y3<=y4){
                                //第三象限
                                this.segments.push({x:x4,y:y3});
                            }
                            else{
                                //第四象限
                                this.segments.push({x:x3,y:y4});
                            }
                            this.segments.push({x:aC2.x,y:aC2.y-ARROW_DIS});
                        }
                        else if(this.anchorTo==2){
                            // 右邊節點入
                            let x3=x1-ARROW_DIS;
                            let y3=y1;
                            let x4=x2+ARROW_DIS;
                            let y4=y2;
                            if(x3<=x4 && y3>=y4){
                                //第一象限
                                this.segments.push({x:x3,y:(y3+y4)/2});
                                this.segments.push({x:x4,y:(y3+y4)/2});
                            }
                            else if(x3>x4 && y3>y4){
                                //第二象限
                                this.segments.push({x:x3,y:y4});
                            }
                            else if(x3>=x4 && y3<=y4){
                                //第三象限
                                this.segments.push({x:x3,y:y4});
                            }
                            else{
                                //第四象限
                                this.segments.push({x:x3,y:(y3+y4)/2});
                                this.segments.push({x:x4,y:(y3+y4)/2});
                            }
                            this.segments.push({x:aC2.x+ARROW_DIS,y:aC2.y});
                        }
                        else if(this.anchorTo==3){
                            // 下邊節點入
                            let x3=x1-ARROW_DIS;
                            let y3=y1;
                            let x4=x2;
                            let y4=y2+ARROW_DIS;
                            if(x3<=x4 && y3>=y4){
                                //第一象限
                                this.segments.push({x:x3,y:y4});
                            }
                            else if(x3>x4 && y3>y4){
                                //第二象限
                                this.segments.push({x:x4,y:y3});
                            }
                            else if(x3>=x4 && y3<=y4){
                                //第三象限
                                this.segments.push({x:x3,y:y4});
                            }
                            else{
                                //第四象限
                                this.segments.push({x:x3,y:y4});
                            }
                            this.segments.push({x:aC2.x,y:aC2.y+ARROW_DIS});
                        }
                    }
                    else if(this.anchorFrom==1){
                        // 上邊節點出
                        this.segments.push({x:aC1.x,y:aC1.y-ARROW_DIS});
                        if(this.anchorTo==0){
                            // 左邊節點入
                            let x3=x1;
                            let y3=y1-ARROW_DIS;
                            let x4=x2-ARROW_DIS;
                            let y4=y2;
                            if(x3<=x4 && y3>=y4){
                                //第一象限
                                this.segments.push({x:x3,y:y4});
                            }
                            else if(x3>x4 && y3>y4){
                                //第二象限
                                this.segments.push({x:x4,y:y3});
                            }
                            else if(x3>=x4 && y3<=y4){
                                //第三象限
                                this.segments.push({x:x4,y:y3});
                            }
                            else{
                                //第四象限
                                this.segments.push({x:x4,y:y3});
                            }

                            this.segments.push({x:aC2.x-ARROW_DIS,y:aC2.y});
                        }
                        else if(this.anchorTo==1){
                            // 上邊節點入
                            let x3=x1;
                            let y3=y1-ARROW_DIS;
                            let x4=x2;
                            let y4=y2-ARROW_DIS;
                            if(x3<=x4 && y3>=y4){
                                //第一象限
                                this.segments.push({x:x3,y:y4});
                            }
                            else if(x3>x4 && y3>y4){
                                //第二象限
                                this.segments.push({x:x3,y:y4});
                            }
                            else if(x3>=x4 && y3<=y4){
                                //第三象限
                                this.segments.push({x:x4,y:y3});
                            }
                            else{
                                //第四象限
                                this.segments.push({x:x4,y:y3});
                            }
                            this.segments.push({x:aC2.x,y:aC2.y-ARROW_DIS});
                        }
                        else if(this.anchorTo==2){
                            // 右邊節點入
                            let x3=x1;
                            let y3=y1-ARROW_DIS;
                            let x4=x2+ARROW_DIS;
                            let y4=y2;
                            if(x3<=x4 && y3>=y4){
                                //第一象限
                                this.segments.push({x:x4,y:y3});
                            }
                            else if(x3>x4 && y3>y4){
                                //第二象限
                                this.segments.push({x:x3,y:y4});
                            }
                            else if(x3>=x4 && y3<=y4){
                                //第三象限
                                this.segments.push({x:x4,y:y3});
                            }
                            else{
                                //第四象限
                                this.segments.push({x:x4,y:y3});
                            }
                            this.segments.push({x:aC2.x+ARROW_DIS,y:aC2.y});
                        }
                        else if(this.anchorTo==3){
                            // 下邊節點入
                            let x3=x1;
                            let y3=y1-ARROW_DIS;
                            let x4=x2;
                            let y4=y2+ARROW_DIS;
                            if(x3<=x4 && y3>=y4){
                                //第一象限
                                this.segments.push({x:x4,y:y3});
                            }
                            else if(x3>x4 && y3>y4){
                                //第二象限
                                this.segments.push({x:x4,y:y3});
                            }
                            else if(x3>=x4 && y3<=y4){
                                //第三象限
                                this.segments.push({x:(x3+x4)/2,y:y3});
                                this.segments.push({x:(x3+x4)/2,y:y4});
                            }
                            else{
                                //第四象限
                                this.segments.push({x:(x3+x4)/2,y:y3});
                                this.segments.push({x:(x3+x4)/2,y:y4});
                            }
                            this.segments.push({x:aC2.x,y:aC2.y+ARROW_DIS});
                        }
                    }
                    else if(this.anchorFrom==2){
                        // 右邊節點出
                        this.segments.push({x:aC1.x+ARROW_DIS,y:aC1.y});
                        if(this.anchorTo==0){
                            // 左邊節點入
                            let x3=x1+ARROW_DIS;
                            let y3=y1;
                            let x4=x2-ARROW_DIS;
                            let y4=y2;
                            if(x3<=x4 && y3>=y4){
                                //第一象限
                                this.segments.push({x:x3,y:y4});
                            }
                            else if(x3>x4 && y3>y4){
                                //第二象限
                                this.segments.push({x:x3,y:(y3+y4)/2});
                                this.segments.push({x:x4,y:(y3+y4)/2});
                            }
                            else if(x3>=x4 && y3<=y4){
                                //第三象限
                                this.segments.push({x:x3,y:(y3+y4)/2});
                                this.segments.push({x:x4,y:(y3+y4)/2});
                            }
                            else{
                                //第四象限
                                this.segments.push({x:x4,y:y3});
                            }

                            this.segments.push({x:aC2.x-ARROW_DIS,y:aC2.y});
                        }
                        else if(this.anchorTo==1){
                            // 上邊節點入
                            let x3=x1+ARROW_DIS;
                            let y3=y1;
                            let x4=x2;
                            let y4=y2-ARROW_DIS;
                            if(x3<=x4 && y3>=y4){
                                //第一象限
                                this.segments.push({x:x3,y:y4});
                            }
                            else if(x3>x4 && y3>y4){
                                //第二象限
                                this.segments.push({x:x3,y:y4});
                            }
                            else if(x3>=x4 && y3<=y4){
                                //第三象限
                                this.segments.push({x:x3,y:y4});
                            }
                            else{
                                //第四象限
                                this.segments.push({x:x4,y:y3});
                            }
                            this.segments.push({x:aC2.x,y:aC2.y-ARROW_DIS});
                        }
                        else if(this.anchorTo==2){
                            // 右邊節點入
                            let x3=x1+ARROW_DIS;
                            let y3=y1;
                            let x4=x2+ARROW_DIS;
                            let y4=y2;
                            if(x3<=x4 && y3>=y4){
                                //第一象限
                                this.segments.push({x:x4,y:y3});
                            }
                            else if(x3>x4 && y3>y4){
                                //第二象限
                                this.segments.push({x:x3,y:y4});
                            }
                            else if(x3>=x4 && y3<=y4){
                                //第三象限
                                this.segments.push({x:x3,y:y4});
                            }
                            else{
                                //第四象限
                                this.segments.push({x:x4,y:y3});
                            }
                            this.segments.push({x:aC2.x+ARROW_DIS,y:aC2.y});
                        }
                        else if(this.anchorTo==3){
                            // 下邊節點入
                            let x3=x1+ARROW_DIS;
                            let y3=y1;
                            let x4=x2;
                            let y4=y2+ARROW_DIS;
                            if(x3<=x4 && y3>=y4){
                                //第一象限
                                this.segments.push({x:x4,y:y3});
                            }
                            else if(x3>x4 && y3>y4){
                                //第二象限
                                this.segments.push({x:x3,y:y4});
                            }
                            else if(x3>=x4 && y3<=y4){
                                //第三象限
                                this.segments.push({x:x3,y:y4});
                            }
                            else{
                                //第四象限
                                this.segments.push({x:x3,y:y4});
                            }
                            this.segments.push({x:aC2.x,y:aC2.y+ARROW_DIS});
                        }
                    }
                    else if(this.anchorFrom==3){
                        // 下邊節點出
                        this.segments.push({x:aC1.x,y:aC1.y+ARROW_DIS});
                        if(this.anchorTo==0){
                            // 左邊節點入
                            let x3=x1;
                            let y3=y1+ARROW_DIS;
                            let x4=x2-ARROW_DIS;
                            let y4=y2;
                            if(x3<=x4 && y3>=y4){
                                //第一象限
                                this.segments.push({x:x4,y:y3});
                            }
                            else if(x3>x4 && y3>y4){
                                //第二象限
                                this.segments.push({x:x4,y:y3});
                            }
                            else if(x3>=x4 && y3<=y4){
                                //第三象限
                                this.segments.push({x:x4,y:y3});
                            }
                            else{
                                //第四象限
                                this.segments.push({x:x3,y:y4});
                            }
                            this.segments.push({x:aC2.x-ARROW_DIS,y:aC2.y});
                        }
                        else if(this.anchorTo==1){
                            // 上邊節點入
                            let x3=x1;
                            let y3=y1+ARROW_DIS;
                            let x4=x2;
                            let y4=y2-ARROW_DIS;
                            if(x3<=x4 && y3>=y4){
                                //第一象限
                                this.segments.push({x:(x3+x4)/2,y:y3});
                                this.segments.push({x:(x3+x4)/2,y:y4});
                            }
                            else if(x3>x4 && y3>y4){
                                //第二象限
                                this.segments.push({x:(x3+x4)/2,y:y3});
                                this.segments.push({x:(x3+x4)/2,y:y4});
                            }
                            else if(x3>=x4 && y3<=y4){
                                //第三象限
                                this.segments.push({x:x4,y:y3});
                            }
                            else{
                                //第四象限
                                this.segments.push({x:x4,y:y3});
                            }
                            this.segments.push({x:aC2.x,y:aC2.y-ARROW_DIS});
                        }
                        else if(this.anchorTo==2){
                            // 右邊節點入
                            let x3=x1;
                            let y3=y1+ARROW_DIS;
                            let x4=x2+ARROW_DIS;
                            let y4=y2;
                            if(x3<=x4 && y3>=y4){
                                //第一象限
                                this.segments.push({x:x4,y:y3});
                            }
                            else if(x3>x4 && y3>y4){
                                //第二象限
                                this.segments.push({x:x4,y:y3});
                            }
                            else if(x3>=x4 && y3<=y4){
                                //第三象限
                                this.segments.push({x:x3,y:y4});
                            }
                            else{
                                //第四象限
                                this.segments.push({x:x4,y:y3});
                            }
                            this.segments.push({x:aC2.x+ARROW_DIS,y:aC2.y});
                        }
                        else if(this.anchorTo==3){
                            // 下邊節點入
                            let x3=x1;
                            let y3=y1+ARROW_DIS;
                            let x4=x2;
                            let y4=y2+ARROW_DIS;
                            if(x3<=x4 && y3>=y4){
                                //第一象限
                                this.segments.push({x:x4,y:y3});
                            }
                            else if(x3>x4 && y3>y4){
                                //第二象限
                                this.segments.push({x:x4,y:y3});
                            }
                            else if(x3>=x4 && y3<=y4){
                                //第三象限
                                this.segments.push({x:x3,y:y4});
                            }
                            else{
                                //第四象限
                                this.segments.push({x:x3,y:y4});
                            }
                            this.segments.push({x:aC2.x,y:aC2.y+ARROW_DIS});
                        }
                    }
                    this.segments.push({x:aC2.x,y:aC2.y});
                    for(let i=2; i<this.segments.length-1; i++){
                        if(this.segments[i].x==aC1.x||this.segments[i-1].x==aC2.x||this.segments[i].y==aC1.y||this.segments[i-1].y==aC2.y){
                            continue;
                        }
                        if(this.segments[i-1].x == this.segments[i].x){
                            this.anchors.push(new model.anchor( (this.segments[i-1].x+this.segments[i].x)/2, (this.segments[i-1].y+this.segments[i].y)/2 , "w-resize") )
                            this.new_anchors.push(new model.anchor( (this.segments[i-1].x+this.segments[i].x)/2, (this.segments[i-1].y+this.segments[i].y)/2 , "w-resize") )
                        }
                        else if(this.segments[i-1].y+this.segments[i].y){
                            this.anchors.push(new model.anchor( (this.segments[i-1].x+this.segments[i].x)/2, (this.segments[i-1].y+this.segments[i].y)/2 , "n-resize") )
                            this.new_anchors.push(new model.anchor( (this.segments[i-1].x+this.segments[i].x)/2, (this.segments[i-1].y+this.segments[i].y)/2 , "n-resize") )
                        }
                    }
                    
                    this.indexText=Math.floor(this.segments.length/2);
                    return;
                }
                else if (this.mode=="square")
                {
                    // console.log(this.anchors)
                    this.new_anchors=[];
                    const ARROW_DIS = 0;
                    var x1=aC1.x;
                    var x2=aC2.x;
                    var y1=aC1.y;
                    var y2=aC2.y;
                    // console.log(this.anchorFrom)
                    if(this.anchorFrom==0){
                        // 左邊節點出
                        this.segments.push({x:aC1.x-ARROW_DIS,y:aC1.y});
                        if(this.anchorTo==0){
                            // 左邊節點入
                            let x3=x1-ARROW_DIS;
                            let y3=y1;
                            let x4=x2-ARROW_DIS;
                            let y4=y2;
                            if(x3<=x4 && y3>=y4){
                                //第一象限
                                this.segments.push({x:this.anchors[0].x,y:y3});
                                this.segments.push({x:this.anchors[0].x,y:y4});
                            }
                            else if(x3>x4 && y3>y4){
                                //第二象限
                                this.segments.push({x:this.anchors[0].x,y:y3});
                                this.segments.push({x:this.anchors[0].x,y:y4});
                            }
                            else if(x3>=x4 && y3<=y4){
                                //第三象限
                                this.segments.push({x:this.anchors[0].x,y:y3});
                                this.segments.push({x:this.anchors[0].x,y:y4});
                            }
                            else{
                                //第四象限
                                this.segments.push({x:this.anchors[0].x,y:y3});
                                this.segments.push({x:this.anchors[0].x,y:y4});
                            }

                        }
                        else if(this.anchorTo==1){
                            // 上邊節點入
                            let x3=x1-ARROW_DIS;
                            let y3=y1;
                            let x4=x2;
                            let y4=y2-ARROW_DIS;
                            if(x3<=x4 && y3>=y4){
                                //第一象限
                                this.segments.push({x:this.anchors[0].x,y:y3});
                                this.segments.push({x:this.anchors[0].x,y:this.anchors[1].y});
                                this.segments.push({x:x4,y:this.anchors[1].y});
                            }
                            else if(x3>x4 && y3>y4){
                                //第二象限
                                this.segments.push({x:this.anchors[0].x,y:y3});
                                this.segments.push({x:this.anchors[0].x,y:this.anchors[1].y});
                                this.segments.push({x:x4,y:this.anchors[1].y});
                            }
                            else if(x3>=x4 && y3<=y4){
                                //第三象限
                                this.segments.push({x:x4,y:y3});
                            }
                            else{
                                //第四象限
                                this.segments.push({x:this.anchors[0].x,y:y3});
                                this.segments.push({x:this.anchors[0].x,y:this.anchors[1].y});
                                this.segments.push({x:x4,y:this.anchors[1].y});
                            }
                        }
                        else if(this.anchorTo==2){
                            // 右邊節點入
                            let x3=x1-ARROW_DIS;
                            let y3=y1;
                            let x4=x2+ARROW_DIS;
                            let y4=y2;
                            if(x3<=x4 && y3>=y4){
                                //第一象限
                                this.segments.push({x:this.anchors[0].x,y:y3});
                                this.segments.push({x:this.anchors[0].x,y:this.anchors[1].y});
                                this.segments.push({x:this.anchors[2].x,y:this.anchors[1].y});
                                this.segments.push({x:this.anchors[2].x,y:y4});
                            }
                            else if(x3>x4 && y3>y4){
                                //第二象限
                                this.segments.push({x:this.anchors[0].x,y:y3});
                                this.segments.push({x:this.anchors[0].x,y:y4});
                            }
                            else if(x3>=x4 && y3<=y4){
                                //第三象限
                                this.segments.push({x:this.anchors[0].x,y:y3});
                                this.segments.push({x:this.anchors[0].x,y:y4});
                            }
                            else{
                                //第四象限
                                this.segments.push({x:this.anchors[0].x,y:y3});
                                this.segments.push({x:this.anchors[0].x,y:this.anchors[1].y});
                                this.segments.push({x:this.anchors[2].x,y:this.anchors[1].y});
                                this.segments.push({x:this.anchors[2].x,y:y4});
                            }
                        }
                        else if(this.anchorTo==3){
                            // 下邊節點入
                            let x3=x1-ARROW_DIS;
                            let y3=y1;
                            let x4=x2;
                            let y4=y2+ARROW_DIS;
                            if(x3<=x4 && y3>=y4){
                                //第一象限
                                this.segments.push({x:this.anchors[0].x,y:y3});
                                this.segments.push({x:this.anchors[0].x,y:this.anchors[1].y});
                                this.segments.push({x:x4,y:this.anchors[1].y});
                            }
                            else if(x3>x4 && y3>y4){
                                //第二象限
                                this.segments.push({x:x4,y:y3});
                            }
                            else if(x3>=x4 && y3<=y4){
                                //第三象限
                                this.segments.push({x:this.anchors[0].x,y:y3});
                                this.segments.push({x:this.anchors[0].x,y:this.anchors[1].y});
                                this.segments.push({x:x4,y:this.anchors[1].y});
                            }
                            else{
                                //第四象限
                                this.segments.push({x:this.anchors[0].x,y:y3});
                                this.segments.push({x:this.anchors[0].x,y:this.anchors[1].y});
                                this.segments.push({x:x4,y:this.anchors[1].y});
                            }
                        }
                    }
                    else if(this.anchorFrom==1){
                        // 上邊節點出
                        this.segments.push({x:aC1.x,y:aC1.y-ARROW_DIS});
                        if(this.anchorTo==0){
                            // 左邊節點入
                            let x3=x1;
                            let y3=y1-ARROW_DIS;
                            let x4=x2-ARROW_DIS;
                            let y4=y2;
                            if(x3<=x4 && y3>=y4){
                                //第一象限
                                this.segments.push({x:this.anchors[0].x,y:y3});
                                this.segments.push({x:this.anchors[0].x,y:y4});
                            }
                            else if(x3>x4 && y3>y4){
                                //第二象限
                                this.segments.push({x:x3,y:this.anchors[0].y});
                                this.segments.push({x:this.anchors[1].x,y:this.anchors[0].y});
                                this.segments.push({x:this.anchors[1].x,y:y4});
                            }
                            else if(x3>=x4 && y3<=y4){
                                //第三象限
                                this.segments.push({x:x3,y:this.anchors[0].y});
                                this.segments.push({x:this.anchors[1].x,y:this.anchors[0].y});
                                this.segments.push({x:this.anchors[1].x,y:y4});
                            }
                            else{
                                //第四象限
                                this.segments.push({x:x3,y:this.anchors[0].y});
                                this.segments.push({x:this.anchors[1].x,y:this.anchors[0].y});
                                this.segments.push({x:this.anchors[1].x,y:y4});
                            }

                        }
                        else if(this.anchorTo==1){
                            // 上邊節點入
                            let x3=x1;
                            let y3=y1-ARROW_DIS;
                            let x4=x2;
                            let y4=y2-ARROW_DIS;
                            this.segments.push({x:x3,y:this.anchors[0].y});
                            this.segments.push({x:x4,y:this.anchors[0].y});
                        }
                        else if(this.anchorTo==2){
                            // 右邊節點入
                            let x3=x1;
                            let y3=y1-ARROW_DIS;
                            let x4=x2+ARROW_DIS;
                            let y4=y2;
                            if(x3<=x4 && y3>=y4){
                                //第一象限
                                this.segments.push({x:x3,y:this.anchors[0].y});
                                this.segments.push({x:this.anchors[1].x,y:this.anchors[0].y});
                                this.segments.push({x:this.anchors[1].x,y:y4});
                            }
                            else if(x3>x4 && y3>y4){
                                //第二象限
                                this.segments.push({x:x3,y:y4});
                            }
                            else if(x3>=x4 && y3<=y4){
                                //第三象限
                                this.segments.push({x:x3,y:this.anchors[0].y});
                                this.segments.push({x:this.anchors[1].x,y:this.anchors[0].y});
                                this.segments.push({x:this.anchors[1].x,y:y4});
                            }
                            else{
                                //第四象限
                                this.segments.push({x:x3,y:this.anchors[0].y});
                                this.segments.push({x:this.anchors[1].x,y:this.anchors[0].y});
                                this.segments.push({x:this.anchors[1].x,y:y4});
                            }
                        }
                        else if(this.anchorTo==3){
                            // 下邊節點入
                            let x3=x1;
                            let y3=y1-ARROW_DIS;
                            let x4=x2;
                            let y4=y2+ARROW_DIS;
                            if(x3<=x4 && y3>=y4){
                                //第一象限
                                this.segments.push({x:x3,y:this.anchors[0].y});
                                this.segments.push({x:x4,y:this.anchors[0].y});
                            }
                            else if(x3>x4 && y3>y4){
                                //第二象限
                                this.segments.push({x:x3,y:this.anchors[0].y});
                                this.segments.push({x:x4,y:this.anchors[0].y});
                            }
                            else if(x3>=x4 && y3<=y4){
                                //第三象限
                                this.segments.push({x:x3,y:this.anchors[0].y});
                                this.segments.push({x:this.anchors[1].x,y:this.anchors[0].y});
                                this.segments.push({x:this.anchors[1].x,y:this.anchors[2].y});
                                this.segments.push({x:x4,y:this.anchors[2].y});
                            }
                            else{
                                //第四象限
                                this.segments.push({x:x3,y:this.anchors[0].y});
                                this.segments.push({x:this.anchors[1].x,y:this.anchors[0].y});
                                this.segments.push({x:this.anchors[1].x,y:this.anchors[2].y});
                                this.segments.push({x:x4,y:this.anchors[2].y});
                            }
                        }
                    }
                    else if(this.anchorFrom==2){
                        // 右邊節點出
                        this.segments.push({x:aC1.x+ARROW_DIS,y:aC1.y});
                        if(this.anchorTo==0){
                            // 左邊節點入
                            let x3=x1+ARROW_DIS;
                            let y3=y1;
                            let x4=x2-ARROW_DIS;
                            let y4=y2;
                            if(x3<=x4 && y3>=y4){
                                //第一象限
                                this.segments.push({x:this.anchors[0].x,y:y3});
                                this.segments.push({x:this.anchors[0].x,y:y4});
                            }
                            else if(x3>x4 && y3>y4){
                                //第二象限
                                this.segments.push({x:this.anchors[0].x,y:y3});
                                this.segments.push({x:this.anchors[0].x,y:this.anchors[1].y});
                                this.segments.push({x:this.anchors[2].x,y:this.anchors[1].y});
                                this.segments.push({x:this.anchors[2].x,y:y4});
                            }
                            else if(x3>=x4 && y3<=y4){
                                //第三象限
                                this.segments.push({x:this.anchors[0].x,y:y3});
                                this.segments.push({x:this.anchors[0].x,y:this.anchors[1].y});
                                this.segments.push({x:this.anchors[2].x,y:this.anchors[1].y});
                                this.segments.push({x:this.anchors[2].x,y:y4});
                            }
                            else{
                                //第四象限
                                this.segments.push({x:this.anchors[0].x,y:y3});
                                this.segments.push({x:this.anchors[0].x,y:y4});
                            }

                        }
                        else if(this.anchorTo==1){
                            // 上邊節點入
                            let x3=x1+ARROW_DIS;
                            let y3=y1;
                            let x4=x2;
                            let y4=y2-ARROW_DIS;
                            if(x3<=x4 && y3>=y4){
                                //第一象限
                                this.segments.push({x:this.anchors[0].x,y:y3});
                                this.segments.push({x:this.anchors[0].x,y:this.anchors[1].y});
                                this.segments.push({x:x4,y:this.anchors[1].y});
                            }
                            else if(x3>x4 && y3>y4){
                                //第二象限
                                this.segments.push({x:this.anchors[0].x,y:y3});
                                this.segments.push({x:this.anchors[0].x,y:this.anchors[1].y});
                                this.segments.push({x:x4,y:this.anchors[1].y});
                            }
                            else if(x3>=x4 && y3<=y4){
                                //第三象限
                                this.segments.push({x:this.anchors[0].x,y:y3});
                                this.segments.push({x:this.anchors[0].x,y:this.anchors[1].y});
                                this.segments.push({x:x4,y:this.anchors[1].y});
                            }
                            else{
                                //第四象限
                                this.segments.push({x:this.anchors[0].x,y:y3});
                                this.segments.push({x:this.anchors[0].x,y:this.anchors[1].y});
                                this.segments.push({x:x4,y:this.anchors[1].y});
                            }
                        }
                        else if(this.anchorTo==2){
                            // 右邊節點入
                            let x3=x1+ARROW_DIS;
                            let y3=y1;
                            let x4=x2+ARROW_DIS;
                            let y4=y2;
                            if(x3<=x4 && y3>=y4){
                                //第一象限
                                this.segments.push({x:this.anchors[0].x,y:y3});
                                this.segments.push({x:this.anchors[0].x,y:y4});
                            }
                            else if(x3>x4 && y3>y4){
                                //第二象限
                                this.segments.push({x:this.anchors[0].x,y:y3});
                                this.segments.push({x:this.anchors[0].x,y:y4});
                            }
                            else if(x3>=x4 && y3<=y4){
                                //第三象限
                                this.segments.push({x:this.anchors[0].x,y:y3});
                                this.segments.push({x:this.anchors[0].x,y:y4});
                            }
                            else{
                                //第四象限
                                this.segments.push({x:this.anchors[0].x,y:y3});
                                this.segments.push({x:this.anchors[0].x,y:y4});
                            }
                        }
                        else if(this.anchorTo==3){
                            // 下邊節點入
                            let x3=x1+ARROW_DIS;
                            let y3=y1;
                            let x4=x2;
                            let y4=y2+ARROW_DIS;
                            if(x3<=x4 && y3>=y4){
                                //第一象限
                                this.segments.push({x:x4,y:y3});
                            }
                            else if(x3>x4 && y3>y4){
                                //第二象限
                                this.segments.push({x:this.anchors[0].x,y:y3});
                                this.segments.push({x:this.anchors[0].x,y:this.anchors[1].y});
                                this.segments.push({x:x4,y:this.anchors[1].y});
                            }
                            else if(x3>=x4 && y3<=y4){
                                //第三象限
                                this.segments.push({x:this.anchors[0].x,y:y3});
                                this.segments.push({x:this.anchors[0].x,y:this.anchors[1].y});
                                this.segments.push({x:x4,y:this.anchors[1].y});
                            }
                            else{
                                //第四象限
                                this.segments.push({x:this.anchors[0].x,y:y3});
                                this.segments.push({x:this.anchors[0].x,y:this.anchors[1].y});
                                this.segments.push({x:x4,y:this.anchors[1].y});
                            }
                        }
                    }
                    else if(this.anchorFrom==3){
                        // 下邊節點出
                        this.segments.push({x:aC1.x,y:aC1.y+ARROW_DIS});
                        if(this.anchorTo==0){
                            // 左邊節點入
                            let x3=x1;
                            let y3=y1+ARROW_DIS;
                            let x4=x2-ARROW_DIS;
                            let y4=y2;
                            if(x3<=x4 && y3>=y4){
                                //第一象限
                                this.segments.push({x:x3,y:this.anchors[0].y});
                                this.segments.push({x:this.anchors[1].x,y:this.anchors[0].y});
                                this.segments.push({x:this.anchors[1].x,y:y4});
                            }
                            else if(x3>x4 && y3>y4){
                                //第二象限
                                this.segments.push({x:x3,y:this.anchors[0].y});
                                this.segments.push({x:this.anchors[1].x,y:this.anchors[0].y});
                                this.segments.push({x:this.anchors[1].x,y:y4});
                            }
                            else if(x3>=x4 && y3<=y4){
                                //第三象限
                                this.segments.push({x:x3,y:this.anchors[0].y});
                                this.segments.push({x:this.anchors[1].x,y:this.anchors[0].y});
                                this.segments.push({x:this.anchors[1].x,y:y4});
                            }
                            else{
                                //第四象限
                                this.segments.push({x:x3,y:y4});
                            }
                        }
                        else if(this.anchorTo==1){
                            // 上邊節點入
                            let x3=x1;
                            let y3=y1+ARROW_DIS;
                            let x4=x2;
                            let y4=y2-ARROW_DIS;
                            if(x3<=x4 && y3>=y4){
                                //第一象限
                                this.segments.push({x:x3,y:this.anchors[0].y});
                                this.segments.push({x:this.anchors[1].x,y:this.anchors[0].y});
                                this.segments.push({x:this.anchors[1].x,y:this.anchors[2].y});
                                this.segments.push({x:x4,y:this.anchors[2].y});
                            }
                            else if(x3>x4 && y3>y4){
                                //第二象限
                                this.segments.push({x:x3,y:this.anchors[0].y});
                                this.segments.push({x:this.anchors[1].x,y:this.anchors[0].y});
                                this.segments.push({x:this.anchors[1].x,y:this.anchors[2].y});
                                this.segments.push({x:x4,y:this.anchors[2].y});
                            }
                            else if(x3>=x4 && y3<=y4){
                                //第三象限
                                this.segments.push({x:x3,y:this.anchors[0].y});
                                this.segments.push({x:x4,y:this.anchors[0].y});
                            }
                            else{
                                //第四象限
                                this.segments.push({x:x3,y:this.anchors[0].y});
                                this.segments.push({x:x4,y:this.anchors[0].y});
                            }
                        }
                        else if(this.anchorTo==2){
                            // 右邊節點入
                            let x3=x1;
                            let y3=y1+ARROW_DIS;
                            let x4=x2+ARROW_DIS;
                            let y4=y2;
                            if(x3<=x4 && y3>=y4){
                                //第一象限
                                this.segments.push({x:x3,y:this.anchors[0].y});
                                this.segments.push({x:this.anchors[1].x,y:this.anchors[0].y});
                                this.segments.push({x:this.anchors[1].x,y:y4});
                            }
                            else if(x3>x4 && y3>y4){
                                //第二象限
                                this.segments.push({x:x3,y:this.anchors[0].y});
                                this.segments.push({x:this.anchors[1].x,y:this.anchors[0].y});
                                this.segments.push({x:this.anchors[1].x,y:y4});
                            }
                            else if(x3>=x4 && y3<=y4){
                                //第三象限
                                this.segments.push({x:x3,y:y4});
                            }
                            else{
                                //第四象限
                                this.segments.push({x:x3,y:this.anchors[0].y});
                                this.segments.push({x:this.anchors[1].x,y:this.anchors[0].y});
                                this.segments.push({x:this.anchors[1].x,y:y4});
                            }
                        }
                        else if(this.anchorTo==3){
                            // 下邊節點入
                            let x3=x1;
                            let y3=y1+ARROW_DIS;
                            let x4=x2;
                            let y4=y2+ARROW_DIS;
                            this.segments.push({x:x3,y:this.anchors[0].y});
                            this.segments.push({x:x4,y:this.anchors[0].y});
                        }
                    }
                    this.segments.push({x:aC2.x,y:aC2.y});
                    let ind = 0;
                    for(let i=2; i<this.segments.length-1; i++){
                        if(this.segments[i].x==aC1.x||this.segments[i-1].x==aC2.x||this.segments[i].y==aC1.y||this.segments[i-1].y==aC2.y){
                            continue;
                        }
                        if(this.segments[i-1].x == this.segments[i].x){
                            this.new_anchors.push(new model.anchor( (this.segments[i-1].x+this.segments[i].x)/2, (this.segments[i-1].y+this.segments[i].y)/2 , "w-resize") )
                            this.anchors[ind].x = (this.segments[i-1].x+this.segments[i].x)/2
                            this.anchors[ind].y = (this.segments[i-1].y+this.segments[i].y)/2 
                            ind++;
                        }
                        else if(this.segments[i-1].y+this.segments[i].y){
                            this.new_anchors.push(new model.anchor( (this.segments[i-1].x+this.segments[i].x)/2, (this.segments[i-1].y+this.segments[i].y)/2 , "n-resize") )
                            this.anchors[ind].x = (this.segments[i-1].x+this.segments[i].x)/2
                            this.anchors[ind].y = (this.segments[i-1].y+this.segments[i].y)/2    
                            ind++;                     
                        }
                    }
                    this.indexText=Math.floor(this.segments.length/2);
                    return;
                }
                else
                {
                    d1=this.directionToVector(model.nodes[from].connectors[this.anchorFrom].cursorClass);
                    d2=this.directionToVector(model.nodes[to].connectors[this.anchorTo].cursorClass);
                }
                
            }

            //LINKTEXT POSITION
            var element0 = this.segments[0];
            var maxD=0;
            this.indexText=1;
            for (let index = 1; index < this.segments.length; index++) {
                const element = this.segments[index];
                var d=Math.abs(element.x-element0.x)+Math.abs(element.y-element0.y);
                if (d>maxD){
                    maxD=d;
                    this.indexText=index;
                }
                element0=element;
            }

        }    
    
        this.checkConflict=function(x1,y1,x2,y2,node){
            if (x1==x2){
                //V
                var nY1=y1;
                var nY2=y2;
                if (y1>y2)
                {
                    nY1=y2;
                    nY2=y1;
                }
                if (x1>=node.x && x1<=node.x+node.w)
                {
                    if (nY1<=node.y && nY2>=node.y)
                    {
                        return "V";
                    }
                }
            }
            else
            {
                //H
            }
            return null;
        }

        this.reSegment();
        
        this.arrow=function(context, fromx, fromy, tox, toy) {
            var headlen = DIAGRAMFLOW_ARROW_SIZE; // length of head in pixels
            headlen=15;
            var dx = tox - fromx;
            var dy = toy - fromy;
            var angle = Math.atan2(dy, dx);
            if (model.rough){
                const rc=rough.canvas(document.getElementById(context.canvas.id));
                rc.line(fromx,fromy,tox,toy);
            }
            else{
                context.beginPath();
                context.moveTo(fromx, fromy);
                context.lineTo(tox, toy);
                context.stroke();
            }

            context.beginPath();
            context.fillStyle="black";
            context.moveTo(tox, toy);
            context.lineTo(tox - headlen * Math.cos(angle - Math.PI / 10), toy - headlen * Math.sin(angle - Math.PI / 10));
            //context.moveTo(tox, toy);
            context.lineTo(tox - headlen * Math.cos(angle + Math.PI / 10), toy - headlen * Math.sin(angle + Math.PI / 10));
            context.fill();
          }        
    
        this.draw=function(ctx){
            //PATH
            ctx.beginPath();
            ctx.lineWidth=2;
            ctx.strokeStyle = this.strokeStyle;
            const element = this.segments[0];
            ctx.moveTo(element.x,element.y);
            for (let index = 1; index < this.segments.length-1; index++) {
                const element = this.segments[index];
                ctx.lineTo(element.x,element.y);
            }
            ctx.stroke();
            //TEXT
            var elementT=this.segments[this.indexText];
            var elementT0=this.segments[this.indexText-1];
            ctx.beginPath();
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(this.text,(elementT.x+elementT0.x)/2,(elementT.y+elementT0.y)/2);
            ctx.fill();

            var elementT=this.segments[this.segments.length-2];
            var elementT0=this.segments[this.segments.length-1];
            this.arrow(ctx,elementT.x,elementT.y,elementT0.x,elementT0.y);
            // //ENDPOINT
            // var element1 = this.segments[this.segments.length-1];
            // ctx.beginPath();
            // ctx.fillStyle=this.strokeStyle;
            // ctx.strokeStyle = this.strokeStyle;
            // ctx.arc(element1.x,element1.y,2*2,0,2*Math.PI,false);
            // ctx.fill();

            
        }
        this.highlight=function(ctx){
            //SEGMENT
            ctx.beginPath();
            ctx.strokeStyle = this.strokeStyleHighlight;
            const element = this.segments[0];
            ctx.moveTo(element.x,element.y);
            for (let index = 1; index < this.segments.length; index++) {
                const element = this.segments[index];
                ctx.lineTo(element.x,element.y);
            }
            var element1 = this.segments[this.segments.length-1];
            ctx.stroke();
            //ENDPOINT
            ctx.beginPath();
            ctx.fillStyle=this.strokeStyleHighlight;
            ctx.strokeStyle = this.strokeStyleHighlight;
            ctx.arc(element1.x,element1.y,2*2,0,2*Math.PI,false);
            ctx.fill();
            
            this.anchors.forEach(element => {
                element.draw(model.ctx,element.x,element.y,0,0);
            });
        }
    
        this.distance=function(a,b){
            return Math.sqrt((a.x-b.x)*(a.x-b.x) + (a.y-b.y)*(a.y-b.y));
        }
        this.isBetween=function(a,c,b){
            return this.distance(a,c)+this.distance(c,b)-this.distance(a,b)<1;
        }
        this.isOverLink=function(point){
            for (let index = 1; index < this.segments.length; index++) {
                const element = this.segments[index];
                const element0 = this.segments[index-1];
                if (this.isBetween(element0,point,element))
                    return true;
            }
            return false;
        }
        this.isInsideAnchors=function(x,y){
            for (let index = 0; index < this.anchors.length; index++) {
                const element = this.anchors[index];
                //console.log(x,y,this.x,this.y,10,10)
                if (element.isInside(x,y,element.x,element.y,0,0))
                {
                    return index;
                }
            }
            return null;
        };
    }
};
var mouse={
    dragging:false,
    dragOrigin:{},
    dragStart:{},
    dragNode:null,
    selNode:null,
    selAnchor:null,
    selConnector:null,
    selLink:null,
    editText:false,
    pause: false,
    clear:function(){
        this.dragging=false
        this.dragOrigin={}
        this.dragStart={}
        this.dragNode=null
        this.selNode=null
        this.selAnchor=null
        this.selConnector=null
        this.selLink=null
        this.editText=false
        this.pause= false
    },
    mouseCoords:function(ev){
        var rect = model.myCanvas.getBoundingClientRect();
        return {x:ev.clientX-rect.left,y:ev.clientY-rect.top};
    },
    down:function(ev){
        mouse.pause = true;
        if (mouse.editText)
        {
            mouse.editText=false;
            var ed=document.getElementById("tmpTextEdit");
            ed.style.display="none";
        }
        var mouseC=mouse.mouseCoords(ev);
        var newselNode=model.findNode(mouseC);

        if (mouse.selConnector!=null)
        {
            mouse.dragging="newlink";
            return
        }
        if (mouse.selAnchor!=null){
            mouse.dragging="anchor";
            model.draw();
            return;
        }
        if (newselNode!=null){
            mouse.selNode=newselNode;
            // Dispatch/Trigger/Fire the event
            var event = new CustomEvent("selectionChanged", { "detail": mouse.selNode });
            document.dispatchEvent(event);
            mouse.dragOrigin={
                    x:mouseC.x-model.nodes[mouse.selNode].x,
                    y:mouseC.y-model.nodes[mouse.selNode].y
                    };
            if (mouse.selAnchor!=null)
            {
                mouse.dragging="anchor";
                model.draw();
                return;
            }
            else{
                model.nodes[mouse.selNode].highlight(model.ctx);
                mouse.selAnchor=model.nodes[mouse.selNode].nearestAnchor(mouseC);
                mouse.dragging="move";

                this.nodesToMove=[];
                this.linksToMove=[];
                for (let j = 0; j < model.links.length; j++) {
                    const elementLinked=model.links[j];
					if(elementLinked==null) continue;
                    if (elementLinked.to==mouse.selNode || elementLinked.from==mouse.selNode){
                        this.linksToMove.push(j);
                    }
                };

                var hostNode=model.nodes[mouse.selNode];
                for (let i = 0; i < model.nodes.length; i++) {
                    const element = model.nodes[i];
					if(element==null) continue;
                    var elemDragOrigin={x:mouseC.x-element.x,y:mouseC.y-element.y};
    
                    if (i!=mouse.selNode && element.x>=hostNode.x && element.x+element.w<=hostNode.x+hostNode.w && element.y>=hostNode.y && element.y+element.h<=hostNode.y+hostNode.h)
                    {
                        this.nodesToMove.push({index:i,elemDragOrigin:elemDragOrigin});

                        for (let j = 0; j < model.links.length; j++) {
                            const elementLinked=model.links[j];
							if(elementLinked==null) continue;
                            if (elementLinked.to==i || elementLinked.from==i){
                                this.linksToMove.push(j);
                            }
                        };
                    }
                }
    
            }
            model.draw();
        }
        else
        {
            if (mouse.selAnchor==null){
                //deselect
                mouse.selNode=null;
                mouse.dragging=null;
                
                model.draw();
                setTimeout(()=>{mouse.pause = false;},10);

                //CHECK LINKS
                for (let index = 0; index < model.links.length; index++) {
                    const element = model.links[index];
					if(element==null) continue;
                    if (element.isOverLink({x:mouseC.x,y:mouseC.y})==true){
                        element.highlight(model.ctx);
                        mouse.dragging="linkedit";
                        mouse.selLink=index;
                        break;
                    }
                }
            }
            else{
                mouse.dragging="anchor";
                model.draw();
            }
        }

        if (mouse.dragging==null){
            mouse.dragging="all";
            this.nodesToMove=[];
            for (let i = 0; i < model.nodes.length; i++) {
                const element = model.nodes[i];
				if(element==null) continue;
                var elemDragOrigin={x:mouseC.x-element.x,y:mouseC.y-element.y};

                this.nodesToMove.push({index:i,elemDragOrigin:elemDragOrigin});
            }
            model.links.forEach(link => {
				if(link){
					// console.log(link)
					link.anchors.forEach(anchor => {
						anchor.dragOrigin = {x:mouseC.x - anchor.x, y:mouseC.y - anchor.y};
					});
					link.reSegment();
				}
            });
        }
        //console.log(mouse.selNode + " " + mouse.selAnchor + " " + mouse.dragging)
    },
    move:function(ev){
        var mouseC=mouse.mouseCoords(ev);
        switch (mouse.dragging) {
            case "all":
                mouse.pause = true;
                this.nodesToMove.forEach(nodeLinked => {
                    const element = model.nodes[nodeLinked.index];
    
                    element.x=mouseC.x-nodeLinked.elemDragOrigin.x;
                    element.y=mouseC.y-nodeLinked.elemDragOrigin.y;
                });
                model.links.forEach(link => {
                    // console.log(link)
					if(link){
						link.anchors.forEach(anchor => {
							anchor.x = mouseC.x-anchor.dragOrigin.x;
							anchor.y = mouseC.y-anchor.dragOrigin.y;
						});
						link.reSegment();
					}
                });
                model.draw();
                break;
            case "newlink":
                model.draw();
                model.ctx.beginPath();
                var aC=model.nodes[mouse.selConnectorNode].connectorCoords(mouse.selConnector);
                model.ctx.moveTo(aC.x,aC.y);
                model.ctx.lineTo(mouseC.x,mouseC.y);
                model.ctx.stroke();
    
                mouse.linkDestNode=null;
                //CHECK DESTINATION connector
                for (let j = 0; j < model.nodes.length; j++) {
					
                    if (j!=mouse.selConnectorNode)
                    {
                        const element = model.nodes[j];
						if(element==null) continue;
                        var i=element.isInsideConnectors(mouseC);
                        if (i!=null){
                            if (element.connectors[i].options.dropAllowed && (element.connectors[i].mode!=model.nodes[mouse.selConnectorNode].connectors[mouse.selConnector].mode || element.connectors[i].mode=="mixed"))
                            {
                                mouse.linkDestNode=j;
                                mouse.linkDestConnector=i;
                                element.connectors[i].highlight(model.ctx,element.x,element.y,element.w,element.h);
                            }
                            break;
                        }
                    }
                }
                break;
            case "move":
                model.nodes[mouse.selNode].x=mouseC.x-mouse.dragOrigin.x;
                model.nodes[mouse.selNode].y=mouseC.y-mouse.dragOrigin.y;
                
                this.nodesToMove.forEach(nodeLinked => {
                    const element = model.nodes[nodeLinked.index];
    
                    element.x=mouseC.x-nodeLinked.elemDragOrigin.x;
                    element.y=mouseC.y-nodeLinked.elemDragOrigin.y;
                });
                this.linksToMove.forEach(elementLinked => {
                    // model.links[elementLinked].anchors = [];
                    model.links[elementLinked].reSegment();
                });
                model.draw();
                break;
            case "anchor":
                if(mouse.selNode!=null){
					switch (model.nodes[mouse.selNode].anchors[mouse.selAnchor].cursorClass) {
						case "move":
							model.nodes[mouse.selNode].x=mouseC.x-mouse.dragOrigin.x;
							model.nodes[mouse.selNode].y=mouseC.y-mouse.dragOrigin.y;
							break;
						case "w-resize":
							if(model.nodes[mouse.selNode].x-mouseC.x + model.nodes[mouse.selNode].w>120){
								model.nodes[mouse.selNode].w= model.nodes[mouse.selNode].x-mouseC.x + model.nodes[mouse.selNode].w;
								model.nodes[mouse.selNode].x= mouseC.x ;
							}
							break;
						case "e-resize":
							if(mouseC.x - model.nodes[mouse.selNode].x>120){
								model.nodes[mouse.selNode].w= mouseC.x - model.nodes[mouse.selNode].x //- mouse.dragOrigin.x;
							}
							break;
						case "ne-resize":
							if(mouseC.x - model.nodes[mouse.selNode].x>120){
								model.nodes[mouse.selNode].w= mouseC.x - model.nodes[mouse.selNode].x //- mouse.dragOrigin.x;
							}
							if(model.nodes[mouse.selNode].y-mouseC.y + model.nodes[mouse.selNode].h>80){
								model.nodes[mouse.selNode].h= model.nodes[mouse.selNode].y-mouseC.y + model.nodes[mouse.selNode].h;
								model.nodes[mouse.selNode].y= mouseC.y;
							}
							break;
						case "se-resize":
							if(mouseC.x - model.nodes[mouse.selNode].x>120){
								model.nodes[mouse.selNode].w= mouseC.x - model.nodes[mouse.selNode].x //- mouse.dragOrigin.x;
							}
							if(mouseC.y - model.nodes[mouse.selNode].y>80){
								model.nodes[mouse.selNode].h= mouseC.y - model.nodes[mouse.selNode].y //- mouse.dragOrigin.x;
							}
							break;
						case "s-resize":
							if(mouseC.y - model.nodes[mouse.selNode].y>80){
								model.nodes[mouse.selNode].h= mouseC.y - model.nodes[mouse.selNode].y //- mouse.dragOrigin.x;
							}
							break;
						case "sw-resize":
							if(model.nodes[mouse.selNode].x-mouseC.x + model.nodes[mouse.selNode].w>120){
								model.nodes[mouse.selNode].w= model.nodes[mouse.selNode].x-mouseC.x + model.nodes[mouse.selNode].w;
								model.nodes[mouse.selNode].x= mouseC.x ;
							}
							if(mouseC.y - model.nodes[mouse.selNode].y>80){
								model.nodes[mouse.selNode].h= mouseC.y - model.nodes[mouse.selNode].y //- mouse.dragOrigin.x;
							}
							break;
						case "nw-resize":
							if(model.nodes[mouse.selNode].x-mouseC.x + model.nodes[mouse.selNode].w>120){
								model.nodes[mouse.selNode].w= model.nodes[mouse.selNode].x-mouseC.x + model.nodes[mouse.selNode].w;
								model.nodes[mouse.selNode].x= mouseC.x ;
							}
							if(model.nodes[mouse.selNode].y-mouseC.y + model.nodes[mouse.selNode].h>80){
								model.nodes[mouse.selNode].h= model.nodes[mouse.selNode].y-mouseC.y + model.nodes[mouse.selNode].h;
								model.nodes[mouse.selNode].y= mouseC.y;
							}
							break;            
						case "n-resize":
							if(model.nodes[mouse.selNode].y-mouseC.y + model.nodes[mouse.selNode].h>80){
								model.nodes[mouse.selNode].h= model.nodes[mouse.selNode].y-mouseC.y + model.nodes[mouse.selNode].h;
								model.nodes[mouse.selNode].y= mouseC.y;
							}
							break;         
						default:
							break;
					}
					
                }
                else if(mouse.selLink!=null){
                    switch (model.links[mouse.selLink].anchors[mouse.selAnchor].cursorClass) {
                        case "w-resize":
                            model.links[mouse.selLink].anchors[mouse.selAnchor].x= mouseC.x ;
                            break;           
                        case "n-resize":
                            model.links[mouse.selLink].anchors[mouse.selAnchor].y= mouseC.y ;
                            break;         
                        default:
                            break;
                    }
                    model.links[mouse.selLink].reSegment();
                }
                
    
                model.links.forEach(element => {
					if(element){
						if (element.to==mouse.selNode || element.from==mouse.selNode){
							element.reSegment();
						}
					}
                });
                model.draw();
                break;
            default:
                if (mouse.selNode!=null){
                    var element=model.nodes[mouse.selNode];
    
                    //in anchor
                    var i=element.isInsideAnchors(mouseC.x,mouseC.y);
                    if (i!=null){
                        mouse.selAnchor=i;
                        model.myCanvas.style.cursor=element.anchors[i].cursorClass;
                        element.anchors[i].highlight(model.ctx,element.x,element.y,element.w,element.h);
                    }
                    else{
                        if (mouse.selAnchor!=null){
                            model.draw();
                        }
                        mouse.selAnchor=null;
                        mouse.dragging=null;
                        model.myCanvas.style.cursor="auto";                    
                    }

                    //CHECK CONNECTOR
                    var found=false;
                    for (let j = 0; j < model.nodes.length; j++) {
                        const element = model.nodes[j];
						if(element==null) continue;
                        var i=element.isInsideConnectors(mouseC);
                        if (i!=null){
                            if (element.connectors[i].options.dragAllowed){
                                mouse.selConnector=i;
                                mouse.selConnectorNode=j;
                                element.connectors[mouse.selConnector].highlight(model.ctx,element.x,element.y,element.w,element.h);
                                found=true;
                                break;
                            }
                        }
                    }
                    if (!found){
                        mouse.selConnector=null;
                        mouse.selConnectorNode=null;
                        model.draw();
                    }
                }
                else if (mouse.selLink!=null){
                    var element=model.links[mouse.selLink];
                    //in anchor
                    var i=element.isInsideAnchors(mouseC.x,mouseC.y);
                    if (i!=null){
                        mouse.selAnchor=i;
                        model.myCanvas.style.cursor=element.anchors[i].cursorClass;
                        element.anchors[i].highlight(model.ctx,element.x,element.y,element.w,element.h);
                    }
                    else{
                        if (mouse.selAnchor!=null){
                            model.draw();
                        }
                        mouse.selAnchor=null;
                        mouse.dragging=null;
                        model.myCanvas.style.cursor="auto";                    
                    }
                }
                else
                {
                    var found=false;
                    for (let j = 0; j < model.nodes.length; j++) {
						
                        const element = model.nodes[j];
						if(element==null) continue;
                        var i=element.isInsideConnectors(mouseC);
                        if (i!=null){
                            if (element.connectors[i].options.dragAllowed){
                                mouse.selConnector=i;
                                mouse.selConnectorNode=j;
                                element.connectors[mouse.selConnector].highlight(model.ctx,element.x,element.y,element.w,element.h);
                                found=true;
                                break;
                            }
                        }
                    }
                    if (!found){
                        mouse.selConnector=null;
                        mouse.selConnectorNode=null;
                        model.draw();
                    }
                    // mouse.selConnector=null;
                }
                break;
        }
    },
    up:function(ev){
        //var mouseC=mouse.mouseCoords(ev);

        if (mouse.dragging!=null){
            if (mouse.dragging=="newlink"){
                if (mouse.linkDestNode!=null)
                {
                    model.addLink(new model.link(mouse.selConnectorNode, mouse.linkDestNode,mouse.selConnector,mouse.linkDestConnector,"",my_mouse.selected_img));
                }
                mouse.linkDestNode=null;
                mouse.selConnectorNode=null;
                mouse.selConnector=null;
                mouse.linkDestConnector=null;
                model.draw();
            }
            mouse.dragging=null;
            mouse.dragOrigin={};
            mouse.dragNode=null;
            mouse.selAnchor=null;
            mouse.selConnector=null;
        }
        
    },
    keydown:function(ev){
        if (ev.keyCode==46){
            if (mouse.selNode!=null){
                //DELETE ALL THE LINKS
                for (let index = 0; index < model.links.length; index++) {
                    const element = model.links[index];
					if(element==null) continue;
                    if (element.from==mouse.selNode || element.to==mouse.selNode){
                        model.links[index]=null;
                    }
                }
                //DELETE NODE
                model.nodes[mouse.selNode]=null;
                mouse.selNode=null;
                model.draw();
            }
            if (mouse.selLink!=null)
            {
                // model.nodes[mouse.selLink.from].linkNum-=1;
                model.links[mouse.selLink]=null;
                mouse.selLink=null;
                model.draw();
            }
        }
		if (ev.key == 'c' && ev.ctrlKey) {
			model.copyNode=model.nodes[mouse.selNode];
		}
		if (ev.key == 'v' && ev.ctrlKey) {
			if(model.copyNode){
				model.addNode(new model.node(model.copyNode.x+30,model.copyNode.y+30,model.copyNode.w,model.copyNode.h,model.copyNode.connectors,model.copyNode.text,"white",model.copyNode.figure));
			}
		}
    },
    dblclick:function(ev){
        if (mouse.selNode!=null){
            /*mouse.editText=true;
            var textNode=model.nodes[mouse.selNode];
            var ed=document.getElementById("tmpTextEdit");
            if (!ed)
                ed=document.createElement("TEXTAREA");
            ed.id="tmpTextEdit";
            ed.style.display="block";
            ed.style.position="absolute";
            ed.style.margin=0;
            ed.style.padding=0;
            var rect = model.myCanvas.getBoundingClientRect();
            ed.style.left=textNode.x +rect.left + "px";
            ed.style.top=textNode.y + rect.top+ "px";
            ed.style.width=textNode.w + "px";
            ed.style.height=textNode.h + "px";
            ed.value=textNode.text;
            ed.addEventListener("keyup",function(){model.nodes[mouse.selNode].text=this.value})
            document.body.appendChild(ed);*/
            document.getElementById("node_info").innerHTML = node_model[model.nodes[mouse.selNode].figure];
            set_var_list();
            
            mouse.pause = true;
            // console.log(mouse.selNode, model.nodes[mouse.selNode].info)
            switch (model.nodes[mouse.selNode].figure){
                case('Circle'):
                    $('input:radio[name=radio][value='+model.nodes[mouse.selNode].text.substr(0,2)+']').attr('checked', true);
                    break;
                case('Parallelogram'):
                    $('input:radio[name=radio][value='+model.nodes[mouse.selNode].text.substr(0,2)+']').attr('checked', true);
					if($('input:radio[name=radio][value=輸出]').attr('checked')=='checked'){
						$("#io_text").text("變數或字串：");
						if(model.nodes[mouse.selNode].text.substr(3)){
							$('#var_select_output').val(model.nodes[mouse.selNode].text.substr(3));
							$('#var_select_output').css('display', 'block');
							$('#var_select').css('display', 'none');
						}
					}
					else{
						if(model.nodes[mouse.selNode].text.substr(3)){
							$('#var_select').val(model.nodes[mouse.selNode].text.substr(3));
							$('#var_select').css('display', 'block');
							$('#var_select_output').css('display', 'none');
						}
					}
                    break;
                case('Diamond'):
                    $("#code").val(model.nodes[mouse.selNode].text);
                    break;
                case('For_Loop'):
					$("#for_number").val(model.nodes[mouse.selNode].text.substr(0,model.nodes[mouse.selNode].text.length-1));
					$('input:radio[name=radio][value=for]').attr('checked', true);
					$('#while_div').css('display', 'none');
					$('#for_div').css('display', 'block');
                    break;
				case('While_Loop'):
					$("#code").val(model.nodes[mouse.selNode].text);
					$('input:radio[name=radio][value=while]').attr('checked', true);
					$('#while_div').css('display', 'block');
					$('#for_div').css('display', 'none');
                    break;
                case('Rectangle'):
                    let t = model.nodes[mouse.selNode].text.split(' 設為 ')
					$('input:radio[name=radio][value="'+model.nodes[mouse.selNode].data+'"]').attr('checked', true);
                    
                    if(t[0]){
                        $('#var_select').val(t[0].trim());
                    }
                    $("#code").val(t[1].split("(取")[0]);

                    break;
                default:
                    // console.log("none")
                    break;
            }

            node_info.showModal();
            var input = document.getElementById("code");
            if(input){
                input.addEventListener("keypress", function(event) {
                if (event.key === "Enter") {
                    event.preventDefault();
                    document.getElementById("hint_yes").click();
                }
                });
            }
            hint_yes.addEventListener("click", function(){
				let text;
				let node_var;
                switch(model.nodes[mouse.selNode].figure){
					case('Circle'):
						text = $("input[name='radio']:checked").val();
						model.nodes[mouse.selNode].text = text; 
						node_info.close();
						mouse.pause = false;
						model.draw();
						break;
					case('Parallelogram'):
						console.log("AAA")
						if( $("input[name='radio']:checked").val()=="輸入" && ( $("#var_select").length==0 || check_var($("#var_select").val(), false) ) )
						{
							text = $("input[name='radio']:checked").val() +  ($("#var_select").val() ? " "+$("#var_select").val() : "");
							model.nodes[mouse.selNode].text = text; 
							model.nodes[mouse.selNode].variables = get_code_var(text);
							node_info.close();
							mouse.pause = false;
							model.draw();
						}
						else if( ( $("input[name='radio']:checked").val()=="輸出" && $("#var_select_output").length==0 || check_var($("#var_select_output").val(), true)))
						{
							text = $("input[name='radio']:checked").val() +  ($("#var_select_output").val() ? " "+$("#var_select_output").val() : "");
							model.nodes[mouse.selNode].text = text; 
							model.nodes[mouse.selNode].variables = get_code_var(text);
							node_info.close();
							mouse.pause = false;
							model.draw();
						}
						else{alert("")}
						break;
					case('Diamond'):
						if( $("#code").length==0||check_var($("#code").val(), true) ){
							text = ($("#code").val() );
							model.nodes[mouse.selNode].text = text; 
							model.nodes[mouse.selNode].variables = get_code_var(text);
							node_info.close();
							mouse.pause = false;
							model.draw();
						}
						break;
					case('For_Loop'):
					case('While_Loop'):
						text = ($("input[name='radio']:checked").val()=="while")?($("#code").val() ):($("#for_number").val() +"次");
						if($("input[name='radio']:checked").val()=='for'){
							model.nodes[mouse.selNode].figure = "For_Loop";
						}
						else{
							model.nodes[mouse.selNode].figure = "While_Loop";
						}
						model.nodes[mouse.selNode].text = text;     
						model.nodes[mouse.selNode].variables = get_code_var(text);
						node_info.close();
						mouse.pause = false;
						model.draw();						
						break;
					case('Rectangle'):
						if( ( $("#code").length==0 || check_var($("#for_number").val(), true) || check_var($("#code").val(), true)) 
					&& (  $("#var_select").length==0 || check_var($("#var_select").val(), false)) ){
							text = ($("#var_select").val() ? " "+$("#var_select").val() : "") +' 設為 '+ ($("#code").val() );
							let data = $("input[name='radio']:checked").val();
							if(data=="Math.round"){
								text += "(取四捨五入)"
							}
							else if(data=="Math.ceil"){
								text += "(取無條件進位)"
							}
							else if(data=="Math.floor"){
								text += "(取無條件捨去)"
							}
							model.nodes[mouse.selNode].text = text; 
							model.nodes[mouse.selNode].data = data;
							node_var = get_code_var(text);
							if(!node_var.includes(($("#var_select").val() ? $("#var_select").val() : ""))){
								node_var.push(($("#var_select").val() ? $("#var_select").val() : ""));
							}
							model.nodes[mouse.selNode].variables = node_var;
							node_info.close();
							mouse.pause = false;
							model.draw();
						}
						break;
					default:
						// console.log("none")
						break;
				}
				
				
			})
              
            hint_no.addEventListener("click", function(){
                node_info.close();
                mouse.pause = false;
            })
        }
        if (mouse.selLink!=null)
        {
            mouse.editText=true;

            var link=model.links[mouse.selLink];
            var elementT=link.segments[link.indexText];
            var elementT0=link.segments[link.indexText-1];
            var x=(elementT.x+elementT0.x)/2;
            var y=(elementT.y+elementT0.y)/2;

            var ed=document.getElementById("tmpTextEdit");
            if (!ed)
                ed=document.createElement("TEXTAREA");
            ed.id="tmpTextEdit";
            ed.style.display="block";
            ed.style.position="absolute";
            ed.style.margin=0;
            ed.style.padding=0;
            var rect = model.myCanvas.getBoundingClientRect();
            ed.style.left=x +rect.left-100 + "px";
            ed.style.top=y + rect.top-10 + "px";
            ed.style.width=200 + "px";
            ed.style.height=20 + "px";
            ed.value=link.text;
            ed.addEventListener("keyup",function(){model.links[mouse.selLink].text=this.value})
            document.body.appendChild(ed);
        }
    },
    // wheel:function(ev){
    //     function MouseWheel (e) {
    //         e = e || window.event;
    //         if(( e.wheelDelta <= 0 || e.detail > 0)){
    //             model.size--;
    //         }
    //         else{
    //             model.size++;
    //         }
    //         alert(['scrolled ', (( e.wheelDelta <= 0 || e.detail > 0) ? 'down' : 'up')].join(''));
    //       }
          
    //       // hook event listener on window object
    //       if ('onmousewheel' in window) {
    //         window.onmousewheel = MouseWheel;
    //       } else if ('onmousewheel' in document) {
    //         document.onmousewheel = MouseWheel;
    //       } else if ('addEventListener' in window) {
    //         window.addEventListener("mousewheel", MouseWheel, false);
    //         window.addEventListener("DOMMouseScroll", MouseWheel, false);
    //       }
    // }
}
var first_mouse={
    dragging:false,
    dragOrigin:{},
    dragStart:{},
    dragNode:null,
    selNode:null,
    selAnchor:null,
    selConnector:null,
    selLink:null,
    editText:false,
    pause: false,
    clear:function(){
        this.dragging=false
        this.dragOrigin={}
        this.dragStart={}
        this.dragNode=null
        this.selNode=null
        this.selAnchor=null
        this.selConnector=null
        this.selLink=null
        this.editText=false
        this.pause= false
    },
    mouseCoords:function(ev){
        var rect = first_model.myCanvas.getBoundingClientRect();
        return {x:ev.clientX-rect.left,y:ev.clientY-rect.top};
    },
    down:function(ev){
        first_mouse.pause = true;
        if (first_mouse.editText)
        {
            first_mouse.editText=false;
            var ed=document.getElementById("tmpTextEdit");
            ed.style.display="none";
        }
        var mouseC=first_mouse.mouseCoords(ev);
        var newselNode=first_model.findNode(mouseC);

        if (first_mouse.selConnector!=null)
        {
            first_mouse.dragging="newlink";
            return
        }
        if (first_mouse.selAnchor!=null){
            first_mouse.dragging="anchor";
            first_model.draw();
            return;
        }
        if (newselNode!=null){
            first_mouse.selNode=newselNode;
            // Dispatch/Trigger/Fire the event
            var event = new CustomEvent("selectionChanged", { "detail": first_mouse.selNode });
            document.dispatchEvent(event);
            first_mouse.dragOrigin={
                    x:mouseC.x-first_model.nodes[first_mouse.selNode].x,
                    y:mouseC.y-first_model.nodes[first_mouse.selNode].y
                    };
            if (first_mouse.selAnchor!=null)
            {
                first_mouse.dragging="anchor";
                first_model.draw();
                return;
            }
            else{
                first_model.nodes[first_mouse.selNode].highlight(first_model.ctx);
                first_mouse.selAnchor=first_model.nodes[first_mouse.selNode].nearestAnchor(mouseC);
                first_mouse.dragging="move";

                this.nodesToMove=[];
                this.linksToMove=[];
                for (let j = 0; j < first_model.links.length; j++) {
                    const elementLinked=first_model.links[j];
					if(elementLinked==null) continue;
                    if (elementLinked.to==first_mouse.selNode || elementLinked.from==first_mouse.selNode){
                        this.linksToMove.push(j);
                    }
                };

                var hostNode=first_model.nodes[first_mouse.selNode];
                for (let i = 0; i < first_model.nodes.length; i++) {
                    const element = first_model.nodes[i];
					if(element==null) continue;
                    var elemDragOrigin={x:mouseC.x-element.x,y:mouseC.y-element.y};
    
                    if (i!=first_mouse.selNode && element.x>=hostNode.x && element.x+element.w<=hostNode.x+hostNode.w && element.y>=hostNode.y && element.y+element.h<=hostNode.y+hostNode.h)
                    {
                        this.nodesToMove.push({index:i,elemDragOrigin:elemDragOrigin});

                        for (let j = 0; j < first_model.links.length; j++) {
                            const elementLinked=first_model.links[j];
							if(elementLinked==null) continue;
                            if (elementLinked.to==i || elementLinked.from==i){
                                this.linksToMove.push(j);
                            }
                        };
                    }
                }
    
            }
            first_model.draw();
        }
        else
        {
            if (first_mouse.selAnchor==null){
                //deselect
                first_mouse.selNode=null;
                first_mouse.dragging=null;
                
                first_model.draw();
                setTimeout(()=>{first_mouse.pause = false;},10);

                //CHECK LINKS
                for (let index = 0; index < first_model.links.length; index++) {
                    const element = first_model.links[index];
					if(element==null) continue;
                    if (element.isOverLink({x:mouseC.x,y:mouseC.y})==true){
                        element.highlight(first_model.ctx);
                        first_mouse.dragging="linkedit";
                        first_mouse.selLink=index;
                        break;
                    }
                }
            }
            else{
                first_mouse.dragging="anchor";
                first_model.draw();
            }
        }

        if (first_mouse.dragging==null){
            first_mouse.dragging="all";
            this.nodesToMove=[];
            for (let i = 0; i < first_model.nodes.length; i++) {
                const element = first_model.nodes[i];
				if(element==null) continue;
                var elemDragOrigin={x:mouseC.x-element.x,y:mouseC.y-element.y};

                this.nodesToMove.push({index:i,elemDragOrigin:elemDragOrigin});
            }
            first_model.links.forEach(link => {
                // console.log(link)
				if(link){
					link.anchors.forEach(anchor => {
						anchor.dragOrigin = {x:mouseC.x - anchor.x, y:mouseC.y - anchor.y};
					});
					link.reSegment();
				}
            });
        }
        //console.log(first_mouse.selNode + " " + first_mouse.selAnchor + " " + first_mouse.dragging)
    },
    move:function(ev){
        var mouseC=first_mouse.mouseCoords(ev);
        switch (first_mouse.dragging) {
            case "all":
                first_mouse.pause = true;
                this.nodesToMove.forEach(nodeLinked => {
                    const element = first_model.nodes[nodeLinked.index];
    
                    element.x=mouseC.x-nodeLinked.elemDragOrigin.x;
                    element.y=mouseC.y-nodeLinked.elemDragOrigin.y;
                });
                first_model.links.forEach(link => {
                    // console.log(link)
					if(link){
						link.anchors.forEach(anchor => {
							anchor.x = mouseC.x-anchor.dragOrigin.x;
							anchor.y = mouseC.y-anchor.dragOrigin.y;
						});
						link.reSegment();
					}
                });
                first_model.draw();
                break;
            case "newlink":
                first_model.draw();
                first_model.ctx.beginPath();
                var aC=first_model.nodes[first_mouse.selConnectorNode].connectorCoords(first_mouse.selConnector);
                first_model.ctx.moveTo(aC.x,aC.y);
                first_model.ctx.lineTo(mouseC.x,mouseC.y);
                first_model.ctx.stroke();
    
                first_mouse.linkDestNode=null;
                //CHECK DESTINATION connector
                for (let j = 0; j < first_model.nodes.length; j++) {
                    if (j!=first_mouse.selConnectorNode)
                    {
                        const element = first_model.nodes[j];
						if(element==null) continue;
                        var i=element.isInsideConnectors(mouseC);
                        if (i!=null){
                            if (element.connectors[i].options.dropAllowed && (element.connectors[i].mode!=first_model.nodes[first_mouse.selConnectorNode].connectors[first_mouse.selConnector].mode || element.connectors[i].mode=="mixed"))
                            {
                                first_mouse.linkDestNode=j;
                                first_mouse.linkDestConnector=i;
                                element.connectors[i].highlight(first_model.ctx,element.x,element.y,element.w,element.h);
                            }
                            break;
                        }
                    }
                }
                break;
            case "move":
                first_model.nodes[first_mouse.selNode].x=mouseC.x-first_mouse.dragOrigin.x;
                first_model.nodes[first_mouse.selNode].y=mouseC.y-first_mouse.dragOrigin.y;
                
                this.nodesToMove.forEach(nodeLinked => {
                    const element = first_model.nodes[nodeLinked.index];
    
                    element.x=mouseC.x-nodeLinked.elemDragOrigin.x;
                    element.y=mouseC.y-nodeLinked.elemDragOrigin.y;
                });
                this.linksToMove.forEach(elementLinked => {
                    // first_model.links[elementLinked].anchors = [];
                    first_model.links[elementLinked].reSegment();
                });
                first_model.draw();
                break;
            case "anchor":
                if(first_mouse.selNode!=null){
					switch (first_model.nodes[first_mouse.selNode].anchors[first_mouse.selAnchor].cursorClass) {
						case "move":
							first_model.nodes[first_mouse.selNode].x=mouseC.x-first_mouse.dragOrigin.x;
							first_model.nodes[first_mouse.selNode].y=mouseC.y-first_mouse.dragOrigin.y;
							break;
						case "w-resize":
							if(first_model.nodes[first_mouse.selNode].x-mouseC.x + first_model.nodes[first_mouse.selNode].w>120){
								first_model.nodes[first_mouse.selNode].w= first_model.nodes[first_mouse.selNode].x-mouseC.x + first_model.nodes[first_mouse.selNode].w;
								first_model.nodes[first_mouse.selNode].x= mouseC.x ;
							}
							break;
						case "e-resize":
							if(mouseC.x - first_model.nodes[first_mouse.selNode].x>120){
								first_model.nodes[first_mouse.selNode].w= mouseC.x - first_model.nodes[first_mouse.selNode].x //- first_mouse.dragOrigin.x;
							}
							break;
						case "ne-resize":
							if(mouseC.x - first_model.nodes[first_mouse.selNode].x>120){
								first_model.nodes[first_mouse.selNode].w= mouseC.x - first_model.nodes[first_mouse.selNode].x //- first_mouse.dragOrigin.x;
							}
							if(first_model.nodes[first_mouse.selNode].y-mouseC.y + first_model.nodes[first_mouse.selNode].h>80){
								first_model.nodes[first_mouse.selNode].h= first_model.nodes[first_mouse.selNode].y-mouseC.y + first_model.nodes[first_mouse.selNode].h;
								first_model.nodes[first_mouse.selNode].y= mouseC.y;
							}
							break;
						case "se-resize":
							if(mouseC.x - first_model.nodes[first_mouse.selNode].x>120){
								first_model.nodes[first_mouse.selNode].w= mouseC.x - first_model.nodes[first_mouse.selNode].x //- first_mouse.dragOrigin.x;
							}
							if(mouseC.y - first_model.nodes[first_mouse.selNode].y>80){
								first_model.nodes[first_mouse.selNode].h= mouseC.y - first_model.nodes[first_mouse.selNode].y //- first_mouse.dragOrigin.x;
							}
							break;
						case "s-resize":
							if(mouseC.y - first_model.nodes[first_mouse.selNode].y>80){
								first_model.nodes[first_mouse.selNode].h= mouseC.y - first_model.nodes[first_mouse.selNode].y //- first_mouse.dragOrigin.x;
							}
							break;
						case "sw-resize":
							if(first_model.nodes[first_mouse.selNode].x-mouseC.x + first_model.nodes[first_mouse.selNode].w>120){
								first_model.nodes[first_mouse.selNode].w= first_model.nodes[first_mouse.selNode].x-mouseC.x + first_model.nodes[first_mouse.selNode].w;
								first_model.nodes[first_mouse.selNode].x= mouseC.x ;
							}
							if(mouseC.y - first_model.nodes[first_mouse.selNode].y>80){
								first_model.nodes[first_mouse.selNode].h= mouseC.y - first_model.nodes[first_mouse.selNode].y //- first_mouse.dragOrigin.x;
							}
							break;
						case "nw-resize":
							if(first_model.nodes[first_mouse.selNode].x-mouseC.x + first_model.nodes[first_mouse.selNode].w>120){
								first_model.nodes[first_mouse.selNode].w= first_model.nodes[first_mouse.selNode].x-mouseC.x + first_model.nodes[first_mouse.selNode].w;
								first_model.nodes[first_mouse.selNode].x= mouseC.x ;
							}
							if(first_model.nodes[first_mouse.selNode].y-mouseC.y + first_model.nodes[first_mouse.selNode].h>80){
								first_model.nodes[first_mouse.selNode].h= first_model.nodes[first_mouse.selNode].y-mouseC.y + first_model.nodes[first_mouse.selNode].h;
								first_model.nodes[first_mouse.selNode].y= mouseC.y;
							}
							break;            
						case "n-resize":
							if(first_model.nodes[first_mouse.selNode].y-mouseC.y + first_model.nodes[first_mouse.selNode].h>80){
								first_model.nodes[first_mouse.selNode].h= first_model.nodes[first_mouse.selNode].y-mouseC.y + first_model.nodes[first_mouse.selNode].h;
								first_model.nodes[first_mouse.selNode].y= mouseC.y;
							}
							break;         
						default:
							break;
					}
					
                }
                else if(first_mouse.selLink!=null){
                    switch (first_model.links[first_mouse.selLink].anchors[first_mouse.selAnchor].cursorClass) {
                        case "w-resize":
                            first_model.links[first_mouse.selLink].anchors[first_mouse.selAnchor].x= mouseC.x ;
                            break;           
                        case "n-resize":
                            first_model.links[first_mouse.selLink].anchors[first_mouse.selAnchor].y= mouseC.y ;
                            break;         
                        default:
                            break;
                    }
                    first_model.links[first_mouse.selLink].reSegment();
                }
                
    
                first_model.links.forEach(element => {
					if(element){
						if (element.to==first_mouse.selNode || element.from==first_mouse.selNode){
							element.reSegment();
						}
					}
                });
                first_model.draw();
                break;
            default:
                if (first_mouse.selNode!=null){
                    var element=first_model.nodes[first_mouse.selNode];
    
                    //in anchor
                    var i=element.isInsideAnchors(mouseC.x,mouseC.y);
                    if (i!=null){
                        first_mouse.selAnchor=i;
                        first_model.myCanvas.style.cursor=element.anchors[i].cursorClass;
                        element.anchors[i].highlight(first_model.ctx,element.x,element.y,element.w,element.h);
                    }
                    else{
                        if (first_mouse.selAnchor!=null){
                            first_model.draw();
                        }
                        first_mouse.selAnchor=null;
                        first_mouse.dragging=null;
                        first_model.myCanvas.style.cursor="auto";                    
                    }

                    //CHECK CONNECTOR
                    var found=false;
                    for (let j = 0; j < first_model.nodes.length; j++) {
                        const element = first_model.nodes[j];
						if(element==null) continue;
                        var i=element.isInsideConnectors(mouseC);
                        if (i!=null){
                            if (element.connectors[i].options.dragAllowed){
                                first_mouse.selConnector=i;
                                first_mouse.selConnectorNode=j;
                                element.connectors[first_mouse.selConnector].highlight(first_model.ctx,element.x,element.y,element.w,element.h);
                                found=true;
                                break;
                            }
                        }
                    }
                    if (!found){
                        first_mouse.selConnector=null;
                        first_mouse.selConnectorNode=null;
                        first_model.draw();
                    }
                }
                else if (first_mouse.selLink!=null){
                    var element=first_model.links[first_mouse.selLink];
                    //in anchor
                    var i=element.isInsideAnchors(mouseC.x,mouseC.y);
                    if (i!=null){
                        first_mouse.selAnchor=i;
                        first_model.myCanvas.style.cursor=element.anchors[i].cursorClass;
                        element.anchors[i].highlight(first_model.ctx,element.x,element.y,element.w,element.h);
                    }
                    else{
                        if (first_mouse.selAnchor!=null){
                            first_model.draw();
                        }
                        first_mouse.selAnchor=null;
                        first_mouse.dragging=null;
                        first_model.myCanvas.style.cursor="auto";                    
                    }
                }
                else
                {
                    var found=false;
                    for (let j = 0; j < first_model.nodes.length; j++) {
                        const element = first_model.nodes[j];
						if(element==null) continue;
                        var i=element.isInsideConnectors(mouseC);
                        if (i!=null){
                            if (element.connectors[i].options.dragAllowed){
                                first_mouse.selConnector=i;
                                first_mouse.selConnectorNode=j;
                                element.connectors[first_mouse.selConnector].highlight(first_model.ctx,element.x,element.y,element.w,element.h);
                                found=true;
                                break;
                            }
                        }
                    }
                    if (!found){
                        first_mouse.selConnector=null;
                        first_mouse.selConnectorNode=null;
                        first_model.draw();
                    }
                    // first_mouse.selConnector=null;
                }
                break;
        }
    },
    up:function(ev){
        //var mouseC=first_mouse.mouseCoords(ev);

        if (first_mouse.dragging!=null){
            if (first_mouse.dragging=="newlink"){
                if (first_mouse.linkDestNode!=null)
                {
                    first_model.addLink(new first_model.link(first_mouse.selConnectorNode, first_mouse.linkDestNode,first_mouse.selConnector,first_mouse.linkDestConnector,"",my_mouse.selected_img));
                }
                first_mouse.linkDestNode=null;
                first_mouse.selConnectorNode=null;
                first_mouse.selConnector=null;
                first_mouse.linkDestConnector=null;
                first_model.draw();
            }
            first_mouse.dragging=null;
            first_mouse.dragOrigin={};
            first_mouse.dragNode=null;
            first_mouse.selAnchor=null;
            first_mouse.selConnector=null;
        }
    },
    keydown:function(ev){
        if (ev.keyCode==46){
            if (first_mouse.selNode!=null){
                //DELETE ALL THE LINKS
                for (let index = 0; index < first_model.links.length; index++) {
                    const element = first_model.links[index];
					if(element==null) continue;
                    if (element.from==first_mouse.selNode || element.to==first_mouse.selNode)
                        first_model.links[index]=null;
                }
                //DELETE NODE
                first_model.nodes.splice(first_mouse.selNode,1);
                first_mouse.selNode=null;
                first_model.draw();
            }
            if (first_mouse.selLink!=null)
            {
                // first_model.nodes[first_mouse.selLink.from].linkNum-=1;
                first_model.links[first_mouse.selLink]=null;
                first_mouse.selLink=null;
                first_model.draw();
            }
        }
    },
    dblclick:function(ev){
        if (first_mouse.selNode!=null){
            /*first_mouse.editText=true;
            var textNode=first_model.nodes[first_mouse.selNode];
            var ed=document.getElementById("tmpTextEdit");
            if (!ed)
                ed=document.createElement("TEXTAREA");
            ed.id="tmpTextEdit";
            ed.style.display="block";
            ed.style.position="absolute";
            ed.style.margin=0;
            ed.style.padding=0;
            var rect = first_model.myCanvas.getBoundingClientRect();
            ed.style.left=textNode.x +rect.left + "px";
            ed.style.top=textNode.y + rect.top+ "px";
            ed.style.width=textNode.w + "px";
            ed.style.height=textNode.h + "px";
            ed.value=textNode.text;
            ed.addEventListener("keyup",function(){first_model.nodes[first_mouse.selNode].text=this.value})
            document.body.appendChild(ed);*/
            document.getElementById("node_info").innerHTML = node_model[first_model.nodes[first_mouse.selNode].figure];
            set_var_list();
            
            first_mouse.pause = true;
            // console.log(first_mouse.selNode, first_model.nodes[first_mouse.selNode].info)
            switch (first_model.nodes[first_mouse.selNode].figure){
				case('Circle'):
					$('input:radio[name=radio][value='+first_model.nodes[first_mouse.selNode].text.substr(0,2)+']').attr('checked', true);
                    break;
				case('Function'):
					$("#doing_something").val(first_model.nodes[first_mouse.selNode].text);
					break;
				default:
					// console.log("none")
					break;
			}

            node_info.showModal();
            var input = document.getElementById("code");
            if(input){
                input.addEventListener("keypress", function(event) {
                if (event.key === "Enter") {
                    event.preventDefault();
                    document.getElementById("hint_yes").click();
                }
                });
            }
            hint_yes.addEventListener("click", function(){
                if( ($("#code").length==0 || $("#code").val().length == 0 || check_var($("#code").val(), true)) && ($("#var_select").length==0 || check_var($("#var_select").val(), false)) ){
                    
                    let text;
                    
                    switch (first_model.nodes[first_mouse.selNode].figure){
						case('Circle'):
							text = $("input[name='radio']:checked").val();
                            first_model.nodes[first_mouse.selNode].text = text; 
                            break;
						case('Function'):
							text =($("#doing_something").val() ? " "+$("#doing_something").val() : "");
							first_model.nodes[first_mouse.selNode].text = text; 
							break;
						default:
							// console.log("none")
							break;
					}
                    node_info.close();
                    first_mouse.pause = false;
                }
                
                first_model.draw();
            })

            hint_no.addEventListener("click", function(){
                node_info.close();
                first_mouse.pause = false;
            })
        }
        if (first_mouse.selLink!=null)
        {
            first_mouse.editText=true;

            var link=first_model.links[first_mouse.selLink];
            var elementT=link.segments[link.indexText];
            var elementT0=link.segments[link.indexText-1];
            var x=(elementT.x+elementT0.x)/2;
            var y=(elementT.y+elementT0.y)/2;

            var ed=document.getElementById("tmpTextEdit");
            if (!ed)
                ed=document.createElement("TEXTAREA");
            ed.id="tmpTextEdit";
            ed.style.display="block";
            ed.style.position="absolute";
            ed.style.margin=0;
            ed.style.padding=0;
            var rect = first_model.myCanvas.getBoundingClientRect();
            ed.style.left=x +rect.left-100 + "px";
            ed.style.top=y + rect.top-10 + "px";
            ed.style.width=200 + "px";
            ed.style.height=20 + "px";
            ed.value=link.text;
            ed.addEventListener("keyup",function(){first_model.links[first_mouse.selLink].text=this.value})
            document.body.appendChild(ed);
        }
    },
    // wheel:function(ev){
    //     function MouseWheel (e) {
    //         e = e || window.event;
    //         if(( e.wheelDelta <= 0 || e.detail > 0)){
    //             first_model.size--;
    //         }
    //         else{
    //             first_model.size++;
    //         }
    //         alert(['scrolled ', (( e.wheelDelta <= 0 || e.detail > 0) ? 'down' : 'up')].join(''));
    //       }
          
    //       // hook event listener on window object
    //       if ('onmousewheel' in window) {
    //         window.onmousewheel = MouseWheel;
    //       } else if ('onmousewheel' in document) {
    //         document.onmousewheel = MouseWheel;
    //       } else if ('addEventListener' in window) {
    //         window.addEventListener("mousewheel", MouseWheel, false);
    //         window.addEventListener("DOMMouseScroll", MouseWheel, false);
    //       }
    // }
}

var first_model={
    ctx:null,
    nodes:[],
    links:[],
    myCanvas:null,
    rough:false,
    size:1,

    addNode:function(node){
        this.nodes.push(node);
    },
    addLink:function(link){
		for(let i= 0; i < this.links.length; i++){
			if(this.links[i]==null) continue;
    		if(this.links[i].from == link.from && this.links[i].to == link.to 
			&& this.links[i].anchorIndexFrom == link.anchorIndexFrom && this.links[i].anchorIndexTo == link.anchorIndexTo){
    			console.log("There is already a link here!");
    			return;
    		}
    	}
        this.links.push(link);
    },

    clean:function(){
        this.ctx.beginPath();

        var grd = this.ctx.createLinearGradient(0, this.myCanvas.height, this.myCanvas.width, 0);
        grd.addColorStop(0, "#eeeeee");
        grd.addColorStop(1, "white");

        // Fill with gradient
        this.ctx.fillStyle = grd;
        this.ctx.fillRect(0, 0, this.myCanvas.width, this.myCanvas.height);
        this.ctx.stroke();
    },

    clear:function(){
        this.nodes=[];
        this.links=[];
        first_mouse.clear();
    },

    draw:function(){
        this.clean();
        for (let index = 0; index < this.nodes.length; index++) {
			if(this.nodes[index]==null) continue;
            this.nodes[index].draw(this.ctx);
        }

        for (let index = 0; index < this.links.length; index++) {
			if(this.links[index]==null) continue;
            this.links[index].draw(this.ctx);
        }
        if (first_mouse.selNode!=null && this.nodes[first_mouse.selNode] != null){
            this.nodes[first_mouse.selNode].highlight(this.ctx);
        }
    },
    init:function(canvasName){
        this.myCanvas=document.getElementById(canvasName);
        this.myCanvasContainer=document.getElementById(canvasName).parentElement;
        this.ctx=this.myCanvas.getContext("2d");
        this.myCanvas.addEventListener("mousedown",first_mouse.down)
        this.myCanvas.addEventListener("mousemove",first_mouse.move)
        this.myCanvas.addEventListener("mouseup",first_mouse.up)
        this.myCanvas.addEventListener("dblclick",first_mouse.dblclick)
        this.myCanvas.addEventListener("wheel",first_mouse.wheel)
        document.addEventListener("keydown",first_mouse.keydown)
        this.myCanvas.ondragstart = function() { return false; };
        this.myCanvas.width=this.myCanvasContainer.clientWidth;
        this.myCanvas.height=this.myCanvasContainer.clientHeight;

        window.addEventListener("resize",function(){
            first_model.myCanvas.width=first_model.myCanvasContainer.clientWidth;
            first_model.myCanvas.height=first_model.myCanvasContainer.clientHeight;
            first_model.draw();
        });

    },

    findNode:function(mouseC){
        var minArea=34435345345344;
        var selIndex=null;
        for (let index = 0; index < this.nodes.length; index++) {
			if(this.nodes[index]==null) continue;
            if (this.nodes[index].isInside(mouseC.x,mouseC.y))
            {
                var calcArea=this.nodes[index].w*this.nodes[index].h;
                if (calcArea<minArea)
                {
                    selIndex=index;
                    minArea=calcArea;
                }
            }
        }
        return selIndex;
    },

    copyFrom:function(sourcefirst_model){
        first_model.nodes=[];
        if (sourcefirst_model.nodes){
            for (let index = 0; index < sourcefirst_model.nodes.length; index++) {
                const element = sourcefirst_model.nodes[index];
				if(element==null) continue;
                var anchors=[];
                element.anchors.forEach(a => {
                    anchors.push(new first_model.anchor(a.x,a.y,a.cursorClass));
                });
                first_model.addNode(new first_model.node(element.x,element.y,element.w,element.h,anchors,element.text,element.fillStyle, element.figure, element.data));
            }
        }
        first_model.links=[];
        if (sourcefirst_model.links){
            for (let index = 0; index < sourcefirst_model.links.length; index++) {
                const element = sourcefirst_model.links[index];
				if(element==null) continue;
                first_model.addLink(new first_model.link(element.from,element.to, element.anchorFrom,element.anchorTo, element.text));
            }
        }
        first_mouse.selNode=null;
        first_mouse.dragging=null;
    },

    selectNode:function(node){
        first_mouse.selNode=node;
        first_model.draw();
    },
    connector:function(x,y,mode,title,decoration,options){
        this.x=x;
        this.y=y;
        this.mode=mode;
        if (options)
            this.options=options;
        else
            this.options={dropAllowed:true, dragAllowed:true,radius:7};
        this.title=title;
        this.decoration={};
        if (decoration){
            if (decoration.fillStyle==null)
                this.decoration.fillStyle="black";
            else
                this.decoration.fillStyle=decoration.fillStyle;
            if (decoration.strokeStyle==null)
                this.decoration.strokeStyle="black";
            else
                this.decoration.strokeStyle=decoration.strokeStyle;
            if (decoration.highlightStrokeStyle==null)
                this.decoration.highlightStrokeStyle="black";
            else
                this.decoration.highlightStrokeStyle=decoration.highlightStrokeStyle;
            if (decoration.highlightText==null)
                this.decoration.highlightText="black";
            else
                this.decoration.highlightText=decoration.highlightText;
        }
        this.draw=function(ctx,originX,originY,width,height){
            ctx.beginPath();
            ctx.lineWidth=1;
            ctx.fillStyle=this.decoration.fillStyle;
            ctx.strokeStyle = this.decoration.strokeStyle;
            ctx.arc(this.x*width+originX,this.y*height+originY,connector_r,0,2*Math.PI,false);
            ctx.fill();
            ctx.stroke();
        }
        this.highlight=function(ctx,originX,originY,width,height){
            ctx.beginPath();
            ctx.lineWidth=2;
            ctx.strokeStyle = this.decoration.highlightStrokeStyle;
            var oX=this.x*width+originX;
            var oY=this.y*height+originY;
            ctx.arc(oX,oY,connector_r,0,2*Math.PI,false);
            ctx.stroke();
            if (this.title!=null)
            {
                ctx.fillStyle = this.decoration.highlightText;
                ctx.textAlign = "center";
                ctx.textBaseline = "top";
                ctx.fillText(this.title,oX,oY+connector_r);
            }
        }
        this.distance=function(x,y,originX,originY,width,height)
        {
            return (x-this.x*width-originX)*(x-this.x*width-originX) + (y-this.y*height-originY)*(y-this.y*height-originY);
        }
        this.isInside=function(x,y,originX,originY,width,height){
            var d=this.distance(x,y,originX,originY,width,height);
            if (d<=connector_r*connector_r){
                return true;
            }
            else
                return false;
        };
    },
    anchor:function(x,y,cursorClass)
    {
        this.x=x;
        this.y=y;
        this.radius=5;
        this.cursorClass=cursorClass;
        this.strokeStyle="gray";
        this.strokeStyleHighlight="red";
        this.dragOrigin={};

        this.draw=function(ctx,originX,originY,width,height){
            ctx.beginPath();
            ctx.strokeStyle = this.strokeStyle;
            ctx.lineWidth=1;
            ctx.rect(x*width+originX-this.radius,y*height+originY-this.radius,this.radius*2,this.radius*2);
            ctx.stroke();
        }
        this.highlight=function(ctx,originX,originY,width,height){
            ctx.beginPath();
            ctx.strokeStyle = this.strokeStyleHighlight;
            var r=this.radius*1.5;
            ctx.rect(x*width+originX-r,y*height+originY-r,r*2,r*2);
            ctx.stroke();
        }
        this.distance=function(x,y,originX,originY,width,height)
        {
            return (x-this.x*width-originX)*(x-this.x*width-originX) + (y-this.y*height-originY)*(y-this.y*height-originY);
        }
        this.isInside=function(x,y,originX,originY,width,height){
            var d=this.distance(x,y,originX,originY,width,height);
            if (d<=this.radius*this.radius){
                return true;
            }
            else
                return false;
        };
    },
    node:function(x,y,w,h,connectors,text,fillStyle,figure,args)
    {
        this.textfill=function(ctx) {
            var fontSize   =  20;
            var lines      =  new Array();
            var width = 0, i, j;
            var result;
            var color = this.strokeStyle || "white";
            var text=this.text;
            var max_width=this.w;
            // Font and size is required for ctx.measureText()
            ctx.textAlign = "left";
            ctx.font   = fontSize + "px Arial";

            ctx.textBaseline = 'middle';
            ctx.textAlign="center";
            // Start calculation
            while ( text.length ) {
                for( i=text.length; ctx.measureText(text.substr(0,i)).width > max_width-14; i-- );
            
                result = text.substr(0,i);
            
                if ( i !== text.length )
                    for( j=0; result.indexOf(" ",j) !== -1; j=result.indexOf(" ",j)+1 );
                
                lines.push( result.substr(0, j|| result.length) );
                width = Math.max( width, ctx.measureText(lines[ lines.length-1 ]).width );
                text  = text.substr( lines[ lines.length-1 ].length, text.length );
            }
            
            ctx.font   = fontSize + "px Arial";

            // Render
            ctx.fillStyle = color;
            var vOffSet=(this.h-(lines.length+1)*(fontSize+5))/2-5;
            for ( i=0, j=lines.length; i<j; ++i ) {
                ctx.fillText( lines[i], this.x+ this.w/2 , this.y  + fontSize + (fontSize+5) * i + vOffSet );
            }
        }
		
        this.x=Number(x);
        this.y=Number(y);
        this.w=Number(w);
        this.h=Number(h);
		this.min_width=120;
        this.data=args;
        this.connectors=connectors;
        this.anchors=[
            new first_model.anchor(0,0,"nw-resize"),
            new first_model.anchor(1,0,"ne-resize"),
            new first_model.anchor(1,1,"se-resize"), 
            new first_model.anchor(0,1,"sw-resize"),
        ];
        this.strokeStyle="black";
        this.fillStyle=fillStyle;
        this.text=text;
        this.figure=figure;
        // this.linkNum = 0;
        this.draw=function(ctx){
            if (typeof (this.figure)==="undefined" || typeof (this.figure)==="function"){
                this.figure="Rectangle";
            }
            else
                Figures[this.figure](ctx,this);
            if (this.connectors!=null)
            {
                this.connectors.forEach(connector=>{
                    connector.draw(ctx,this.x,this.y,this.w,this.h);
                });
            }
        };
        this.connectorCoords=function(connectorIndex){
            return {x:this.x+this.connectors[connectorIndex].x*this.w,
                    y:this.y+this.connectors[connectorIndex].y*this.h};
        }
        this.anchorCoords=function(anchorIndex){
            return {x:this.x+this.anchors[anchorIndex].x*this.w,y:this.y+this.anchors[anchorIndex].y*this.h};
        }
        this.isInside=function(x,y){
            if (x>=this.x && x<=this.x+this.w && y>=this.y && y<=this.y+this.h)
                return true;
            else
                return false;
        };
        this.isInsideConnectors=function(point){
            if (this.connectors)
                for (let index = 0; index < this.connectors.length; index++) {
                    const element = this.connectors[index];
                    if (element.isInside(point.x,point.y,this.x,this.y,this.w,this.h))
                    {
                        return index;
                    }
                }
            return null;
        };
        this.isInsideAnchors=function(x,y){
            for (let index = 0; index < this.anchors.length; index++) {
                const element = this.anchors[index];
                if (element.isInside(x,y,this.x,this.y,this.w,this.h))
                {
                    return index;
                }
            }
            return null;
        };
        this.nearestAnchor=function(mouseC){
            var dMin=999999;
            var sel=null;
            for (let index = 0; index < this.anchors.length; index++) {
                const element = this.anchors[index];
                var d=element.distance(mouseC.x,mouseC.y,this.x,this.y,this.w,this.h);
                if (d<dMin && element.cursorClass!="move")
                {
                    dMin=d;
                    sel=index;
                }
            }
            return sel;
        };
        this.highlight=function(ctx){
            this.anchors.forEach(element => {
                element.draw(ctx,this.x,this.y,this.w,this.h);
            });
        }
    },
    link:function(from,to,anchorIndexFrom,anchorIndexTo,text,mode){
        this.directionToVector=function(cursorClass){
            switch (cursorClass) {
            case "w-resize":
                return {x:-1,y:0};
            case "e-resize":
                return {x:1,y:0};
            case "s-resize":
                return {x:0,y:1};
            case "n-resize":
                return {x:0,y:-1};
            case "ne-resize":
                return {x:1,y:-1};
            case "nw-resize":
                return {x:-1,y:-1};
            case "se-resize":
                return {x:1,y:1};
            case "sw-resize":
                return {x:-1,y:1};
            }
        }
    
        this.from=from;
        this.to=to;
        this.anchorFrom=anchorIndexFrom;
        this.anchorTo=anchorIndexTo;
        this.segments=[];
        this.strokeStyle="black";
        this.strokeStyleHighlight="red";
        this.indexText=0;
        this.text=text;
        this.anchors=[];
        this.new_anchors=[];
        if (mode!=null)
            this.mode=mode.toLowerCase();
        else
            this.mode="straight";
        
        // first_model.nodes[this.from].linkNum += 1;
    
        this.reSegment=function(){
            if (this.mode=="straight" || this.mode==null)
            {
                var aC1=first_model.nodes[this.from].connectorCoords(this.anchorFrom);
                var aC2=first_model.nodes[this.to].connectorCoords(this.anchorTo);
                this.segments=[{x:aC1.x,y:aC1.y},{x:aC2.x,y:aC2.y}];
                this.indexText=1;
            }
            else
            {
                this.segments=[];
                var aC1=first_model.nodes[this.from].connectorCoords(this.anchorFrom);
                var aC2=first_model.nodes[this.to].connectorCoords(this.anchorTo);

                this.segments.push({x:aC1.x,y:aC1.y});
                if (this.mode=="square" && (this.anchors.length==0 || this.anchors.length!=this.new_anchors.length) )
                {
                    this.anchors=[];
                    this.new_anchors=[];
                    const ARROW_DIS = 20;
                    var x1=aC1.x;
                    var x2=aC2.x;
                    var y1=aC1.y;
                    var y2=aC2.y;
                    // console.log(this.anchorFrom)
                    if(this.anchorFrom==0){
                        // 左邊節點出
                        this.segments.push({x:aC1.x-ARROW_DIS,y:aC1.y});
                        if(this.anchorTo==0){
                            // 左邊節點入
                            let x3=x1-ARROW_DIS;
                            let y3=y1;
                            let x4=x2-ARROW_DIS;
                            let y4=y2;
                            if(x3<=x4 && y3>=y4){
                                //第一象限
                                this.segments.push({x:x3,y:y4});
                            }
                            else if(x3>x4 && y3>y4){
                                //第二象限
                                this.segments.push({x:x4,y:y3});
                            }
                            else if(x3>=x4 && y3<=y4){
                                //第三象限
                                this.segments.push({x:x4,y:y3});
                            }
                            else{
                                //第四象限
                                this.segments.push({x:x3,y:y4});
                            }

                            this.segments.push({x:aC2.x-ARROW_DIS,y:aC2.y});
                        }
                        else if(this.anchorTo==1){
                            // 上邊節點入
                            let x3=x1-ARROW_DIS;
                            let y3=y1;
                            let x4=x2;
                            let y4=y2-ARROW_DIS;
                            if(x3<=x4 && y3>=y4){
                                //第一象限
                                this.segments.push({x:x3,y:y4});
                            }
                            else if(x3>x4 && y3>y4){
                                //第二象限
                                this.segments.push({x:x3,y:y4});
                            }
                            else if(x3>=x4 && y3<=y4){
                                //第三象限
                                this.segments.push({x:x4,y:y3});
                            }
                            else{
                                //第四象限
                                this.segments.push({x:x3,y:y4});
                            }
                            this.segments.push({x:aC2.x,y:aC2.y-ARROW_DIS});
                        }
                        else if(this.anchorTo==2){
                            // 右邊節點入
                            let x3=x1-ARROW_DIS;
                            let y3=y1;
                            let x4=x2+ARROW_DIS;
                            let y4=y2;
                            if(x3<=x4 && y3>=y4){
                                //第一象限
                                this.segments.push({x:x3,y:(y3+y4)/2});
                                this.segments.push({x:x4,y:(y3+y4)/2});
                            }
                            else if(x3>x4 && y3>y4){
                                //第二象限
                                this.segments.push({x:x3,y:y4});
                            }
                            else if(x3>=x4 && y3<=y4){
                                //第三象限
                                this.segments.push({x:x3,y:y4});
                            }
                            else{
                                //第四象限
                                this.segments.push({x:x3,y:(y3+y4)/2});
                                this.segments.push({x:x4,y:(y3+y4)/2});
                            }
                            this.segments.push({x:aC2.x+ARROW_DIS,y:aC2.y});
                        }
                        else if(this.anchorTo==3){
                            // 下邊節點入
                            let x3=x1-ARROW_DIS;
                            let y3=y1;
                            let x4=x2;
                            let y4=y2+ARROW_DIS;
                            if(x3<=x4 && y3>=y4){
                                //第一象限
                                this.segments.push({x:x3,y:y4});
                            }
                            else if(x3>x4 && y3>y4){
                                //第二象限
                                this.segments.push({x:x4,y:y3});
                            }
                            else if(x3>=x4 && y3<=y4){
                                //第三象限
                                this.segments.push({x:x3,y:y4});
                            }
                            else{
                                //第四象限
                                this.segments.push({x:x3,y:y4});
                            }
                            this.segments.push({x:aC2.x,y:aC2.y+ARROW_DIS});
                        }
                    }
                    else if(this.anchorFrom==1){
                        // 上邊節點出
                        this.segments.push({x:aC1.x,y:aC1.y-ARROW_DIS});
                        if(this.anchorTo==0){
                            // 左邊節點入
                            let x3=x1;
                            let y3=y1-ARROW_DIS;
                            let x4=x2-ARROW_DIS;
                            let y4=y2;
                            if(x3<=x4 && y3>=y4){
                                //第一象限
                                this.segments.push({x:x3,y:y4});
                            }
                            else if(x3>x4 && y3>y4){
                                //第二象限
                                this.segments.push({x:x4,y:y3});
                            }
                            else if(x3>=x4 && y3<=y4){
                                //第三象限
                                this.segments.push({x:x4,y:y3});
                            }
                            else{
                                //第四象限
                                this.segments.push({x:x4,y:y3});
                            }

                            this.segments.push({x:aC2.x-ARROW_DIS,y:aC2.y});
                        }
                        else if(this.anchorTo==1){
                            // 上邊節點入
                            let x3=x1;
                            let y3=y1-ARROW_DIS;
                            let x4=x2;
                            let y4=y2-ARROW_DIS;
                            if(x3<=x4 && y3>=y4){
                                //第一象限
                                this.segments.push({x:x3,y:y4});
                            }
                            else if(x3>x4 && y3>y4){
                                //第二象限
                                this.segments.push({x:x3,y:y4});
                            }
                            else if(x3>=x4 && y3<=y4){
                                //第三象限
                                this.segments.push({x:x4,y:y3});
                            }
                            else{
                                //第四象限
                                this.segments.push({x:x4,y:y3});
                            }
                            this.segments.push({x:aC2.x,y:aC2.y-ARROW_DIS});
                        }
                        else if(this.anchorTo==2){
                            // 右邊節點入
                            let x3=x1;
                            let y3=y1-ARROW_DIS;
                            let x4=x2+ARROW_DIS;
                            let y4=y2;
                            if(x3<=x4 && y3>=y4){
                                //第一象限
                                this.segments.push({x:x4,y:y3});
                            }
                            else if(x3>x4 && y3>y4){
                                //第二象限
                                this.segments.push({x:x3,y:y4});
                            }
                            else if(x3>=x4 && y3<=y4){
                                //第三象限
                                this.segments.push({x:x4,y:y3});
                            }
                            else{
                                //第四象限
                                this.segments.push({x:x4,y:y3});
                            }
                            this.segments.push({x:aC2.x+ARROW_DIS,y:aC2.y});
                        }
                        else if(this.anchorTo==3){
                            // 下邊節點入
                            let x3=x1;
                            let y3=y1-ARROW_DIS;
                            let x4=x2;
                            let y4=y2+ARROW_DIS;
                            if(x3<=x4 && y3>=y4){
                                //第一象限
                                this.segments.push({x:x4,y:y3});
                            }
                            else if(x3>x4 && y3>y4){
                                //第二象限
                                this.segments.push({x:x4,y:y3});
                            }
                            else if(x3>=x4 && y3<=y4){
                                //第三象限
                                this.segments.push({x:(x3+x4)/2,y:y3});
                                this.segments.push({x:(x3+x4)/2,y:y4});
                            }
                            else{
                                //第四象限
                                this.segments.push({x:(x3+x4)/2,y:y3});
                                this.segments.push({x:(x3+x4)/2,y:y4});
                            }
                            this.segments.push({x:aC2.x,y:aC2.y+ARROW_DIS});
                        }
                    }
                    else if(this.anchorFrom==2){
                        // 右邊節點出
                        this.segments.push({x:aC1.x+ARROW_DIS,y:aC1.y});
                        if(this.anchorTo==0){
                            // 左邊節點入
                            let x3=x1+ARROW_DIS;
                            let y3=y1;
                            let x4=x2-ARROW_DIS;
                            let y4=y2;
                            if(x3<=x4 && y3>=y4){
                                //第一象限
                                this.segments.push({x:x3,y:y4});
                            }
                            else if(x3>x4 && y3>y4){
                                //第二象限
                                this.segments.push({x:x3,y:(y3+y4)/2});
                                this.segments.push({x:x4,y:(y3+y4)/2});
                            }
                            else if(x3>=x4 && y3<=y4){
                                //第三象限
                                this.segments.push({x:x3,y:(y3+y4)/2});
                                this.segments.push({x:x4,y:(y3+y4)/2});
                            }
                            else{
                                //第四象限
                                this.segments.push({x:x4,y:y3});
                            }

                            this.segments.push({x:aC2.x-ARROW_DIS,y:aC2.y});
                        }
                        else if(this.anchorTo==1){
                            // 上邊節點入
                            let x3=x1+ARROW_DIS;
                            let y3=y1;
                            let x4=x2;
                            let y4=y2-ARROW_DIS;
                            if(x3<=x4 && y3>=y4){
                                //第一象限
                                this.segments.push({x:x3,y:y4});
                            }
                            else if(x3>x4 && y3>y4){
                                //第二象限
                                this.segments.push({x:x3,y:y4});
                            }
                            else if(x3>=x4 && y3<=y4){
                                //第三象限
                                this.segments.push({x:x3,y:y4});
                            }
                            else{
                                //第四象限
                                this.segments.push({x:x4,y:y3});
                            }
                            this.segments.push({x:aC2.x,y:aC2.y-ARROW_DIS});
                        }
                        else if(this.anchorTo==2){
                            // 右邊節點入
                            let x3=x1+ARROW_DIS;
                            let y3=y1;
                            let x4=x2+ARROW_DIS;
                            let y4=y2;
                            if(x3<=x4 && y3>=y4){
                                //第一象限
                                this.segments.push({x:x4,y:y3});
                            }
                            else if(x3>x4 && y3>y4){
                                //第二象限
                                this.segments.push({x:x3,y:y4});
                            }
                            else if(x3>=x4 && y3<=y4){
                                //第三象限
                                this.segments.push({x:x3,y:y4});
                            }
                            else{
                                //第四象限
                                this.segments.push({x:x4,y:y3});
                            }
                            this.segments.push({x:aC2.x+ARROW_DIS,y:aC2.y});
                        }
                        else if(this.anchorTo==3){
                            // 下邊節點入
                            let x3=x1+ARROW_DIS;
                            let y3=y1;
                            let x4=x2;
                            let y4=y2+ARROW_DIS;
                            if(x3<=x4 && y3>=y4){
                                //第一象限
                                this.segments.push({x:x4,y:y3});
                            }
                            else if(x3>x4 && y3>y4){
                                //第二象限
                                this.segments.push({x:x3,y:y4});
                            }
                            else if(x3>=x4 && y3<=y4){
                                //第三象限
                                this.segments.push({x:x3,y:y4});
                            }
                            else{
                                //第四象限
                                this.segments.push({x:x3,y:y4});
                            }
                            this.segments.push({x:aC2.x,y:aC2.y+ARROW_DIS});
                        }
                    }
                    else if(this.anchorFrom==3){
                        // 下邊節點出
                        this.segments.push({x:aC1.x,y:aC1.y+ARROW_DIS});
                        if(this.anchorTo==0){
                            // 左邊節點入
                            let x3=x1;
                            let y3=y1+ARROW_DIS;
                            let x4=x2-ARROW_DIS;
                            let y4=y2;
                            if(x3<=x4 && y3>=y4){
                                //第一象限
                                this.segments.push({x:x4,y:y3});
                            }
                            else if(x3>x4 && y3>y4){
                                //第二象限
                                this.segments.push({x:x4,y:y3});
                            }
                            else if(x3>=x4 && y3<=y4){
                                //第三象限
                                this.segments.push({x:x4,y:y3});
                            }
                            else{
                                //第四象限
                                this.segments.push({x:x3,y:y4});
                            }
                            this.segments.push({x:aC2.x-ARROW_DIS,y:aC2.y});
                        }
                        else if(this.anchorTo==1){
                            // 上邊節點入
                            let x3=x1;
                            let y3=y1+ARROW_DIS;
                            let x4=x2;
                            let y4=y2-ARROW_DIS;
                            if(x3<=x4 && y3>=y4){
                                //第一象限
                                this.segments.push({x:(x3+x4)/2,y:y3});
                                this.segments.push({x:(x3+x4)/2,y:y4});
                            }
                            else if(x3>x4 && y3>y4){
                                //第二象限
                                this.segments.push({x:(x3+x4)/2,y:y3});
                                this.segments.push({x:(x3+x4)/2,y:y4});
                            }
                            else if(x3>=x4 && y3<=y4){
                                //第三象限
                                this.segments.push({x:x4,y:y3});
                            }
                            else{
                                //第四象限
                                this.segments.push({x:x4,y:y3});
                            }
                            this.segments.push({x:aC2.x,y:aC2.y-ARROW_DIS});
                        }
                        else if(this.anchorTo==2){
                            // 右邊節點入
                            let x3=x1;
                            let y3=y1+ARROW_DIS;
                            let x4=x2+ARROW_DIS;
                            let y4=y2;
                            if(x3<=x4 && y3>=y4){
                                //第一象限
                                this.segments.push({x:x4,y:y3});
                            }
                            else if(x3>x4 && y3>y4){
                                //第二象限
                                this.segments.push({x:x4,y:y3});
                            }
                            else if(x3>=x4 && y3<=y4){
                                //第三象限
                                this.segments.push({x:x3,y:y4});
                            }
                            else{
                                //第四象限
                                this.segments.push({x:x4,y:y3});
                            }
                            this.segments.push({x:aC2.x+ARROW_DIS,y:aC2.y});
                        }
                        else if(this.anchorTo==3){
                            // 下邊節點入
                            let x3=x1;
                            let y3=y1+ARROW_DIS;
                            let x4=x2;
                            let y4=y2+ARROW_DIS;
                            if(x3<=x4 && y3>=y4){
                                //第一象限
                                this.segments.push({x:x4,y:y3});
                            }
                            else if(x3>x4 && y3>y4){
                                //第二象限
                                this.segments.push({x:x4,y:y3});
                            }
                            else if(x3>=x4 && y3<=y4){
                                //第三象限
                                this.segments.push({x:x3,y:y4});
                            }
                            else{
                                //第四象限
                                this.segments.push({x:x3,y:y4});
                            }
                            this.segments.push({x:aC2.x,y:aC2.y+ARROW_DIS});
                        }
                    }
                    this.segments.push({x:aC2.x,y:aC2.y});
                    for(let i=2; i<this.segments.length-1; i++){
                        if(this.segments[i].x==aC1.x||this.segments[i-1].x==aC2.x||this.segments[i].y==aC1.y||this.segments[i-1].y==aC2.y){
                            continue;
                        }
                        if(this.segments[i-1].x == this.segments[i].x){
                            this.anchors.push(new first_model.anchor( (this.segments[i-1].x+this.segments[i].x)/2, (this.segments[i-1].y+this.segments[i].y)/2 , "w-resize") )
                            this.new_anchors.push(new first_model.anchor( (this.segments[i-1].x+this.segments[i].x)/2, (this.segments[i-1].y+this.segments[i].y)/2 , "w-resize") )
                        }
                        else if(this.segments[i-1].y+this.segments[i].y){
                            this.anchors.push(new first_model.anchor( (this.segments[i-1].x+this.segments[i].x)/2, (this.segments[i-1].y+this.segments[i].y)/2 , "n-resize") )
                            this.new_anchors.push(new first_model.anchor( (this.segments[i-1].x+this.segments[i].x)/2, (this.segments[i-1].y+this.segments[i].y)/2 , "n-resize") )
                        }
                    }
                    
                    this.indexText=Math.floor(this.segments.length/2);
                    return;
                }
                else if (this.mode=="square")
                {
                    // console.log(this.anchors)
                    this.new_anchors=[];
                    const ARROW_DIS = 0;
                    var x1=aC1.x;
                    var x2=aC2.x;
                    var y1=aC1.y;
                    var y2=aC2.y;
                    // console.log(this.anchorFrom)
                    if(this.anchorFrom==0){
                        // 左邊節點出
                        this.segments.push({x:aC1.x-ARROW_DIS,y:aC1.y});
                        if(this.anchorTo==0){
                            // 左邊節點入
                            let x3=x1-ARROW_DIS;
                            let y3=y1;
                            let x4=x2-ARROW_DIS;
                            let y4=y2;
                            if(x3<=x4 && y3>=y4){
                                //第一象限
                                this.segments.push({x:this.anchors[0].x,y:y3});
                                this.segments.push({x:this.anchors[0].x,y:y4});
                            }
                            else if(x3>x4 && y3>y4){
                                //第二象限
                                this.segments.push({x:this.anchors[0].x,y:y3});
                                this.segments.push({x:this.anchors[0].x,y:y4});
                            }
                            else if(x3>=x4 && y3<=y4){
                                //第三象限
                                this.segments.push({x:this.anchors[0].x,y:y3});
                                this.segments.push({x:this.anchors[0].x,y:y4});
                            }
                            else{
                                //第四象限
                                this.segments.push({x:this.anchors[0].x,y:y3});
                                this.segments.push({x:this.anchors[0].x,y:y4});
                            }

                        }
                        else if(this.anchorTo==1){
                            // 上邊節點入
                            let x3=x1-ARROW_DIS;
                            let y3=y1;
                            let x4=x2;
                            let y4=y2-ARROW_DIS;
                            if(x3<=x4 && y3>=y4){
                                //第一象限
                                this.segments.push({x:this.anchors[0].x,y:y3});
                                this.segments.push({x:this.anchors[0].x,y:this.anchors[1].y});
                                this.segments.push({x:x4,y:this.anchors[1].y});
                            }
                            else if(x3>x4 && y3>y4){
                                //第二象限
                                this.segments.push({x:this.anchors[0].x,y:y3});
                                this.segments.push({x:this.anchors[0].x,y:this.anchors[1].y});
                                this.segments.push({x:x4,y:this.anchors[1].y});
                            }
                            else if(x3>=x4 && y3<=y4){
                                //第三象限
                                this.segments.push({x:x4,y:y3});
                            }
                            else{
                                //第四象限
                                this.segments.push({x:this.anchors[0].x,y:y3});
                                this.segments.push({x:this.anchors[0].x,y:this.anchors[1].y});
                                this.segments.push({x:x4,y:this.anchors[1].y});
                            }
                        }
                        else if(this.anchorTo==2){
                            // 右邊節點入
                            let x3=x1-ARROW_DIS;
                            let y3=y1;
                            let x4=x2+ARROW_DIS;
                            let y4=y2;
                            if(x3<=x4 && y3>=y4){
                                //第一象限
                                this.segments.push({x:this.anchors[0].x,y:y3});
                                this.segments.push({x:this.anchors[0].x,y:this.anchors[1].y});
                                this.segments.push({x:this.anchors[2].x,y:this.anchors[1].y});
                                this.segments.push({x:this.anchors[2].x,y:y4});
                            }
                            else if(x3>x4 && y3>y4){
                                //第二象限
                                this.segments.push({x:this.anchors[0].x,y:y3});
                                this.segments.push({x:this.anchors[0].x,y:y4});
                            }
                            else if(x3>=x4 && y3<=y4){
                                //第三象限
                                this.segments.push({x:this.anchors[0].x,y:y3});
                                this.segments.push({x:this.anchors[0].x,y:y4});
                            }
                            else{
                                //第四象限
                                this.segments.push({x:this.anchors[0].x,y:y3});
                                this.segments.push({x:this.anchors[0].x,y:this.anchors[1].y});
                                this.segments.push({x:this.anchors[2].x,y:this.anchors[1].y});
                                this.segments.push({x:this.anchors[2].x,y:y4});
                            }
                        }
                        else if(this.anchorTo==3){
                            // 下邊節點入
                            let x3=x1-ARROW_DIS;
                            let y3=y1;
                            let x4=x2;
                            let y4=y2+ARROW_DIS;
                            if(x3<=x4 && y3>=y4){
                                //第一象限
                                this.segments.push({x:this.anchors[0].x,y:y3});
                                this.segments.push({x:this.anchors[0].x,y:this.anchors[1].y});
                                this.segments.push({x:x4,y:this.anchors[1].y});
                            }
                            else if(x3>x4 && y3>y4){
                                //第二象限
                                this.segments.push({x:x4,y:y3});
                            }
                            else if(x3>=x4 && y3<=y4){
                                //第三象限
                                this.segments.push({x:this.anchors[0].x,y:y3});
                                this.segments.push({x:this.anchors[0].x,y:this.anchors[1].y});
                                this.segments.push({x:x4,y:this.anchors[1].y});
                            }
                            else{
                                //第四象限
                                this.segments.push({x:this.anchors[0].x,y:y3});
                                this.segments.push({x:this.anchors[0].x,y:this.anchors[1].y});
                                this.segments.push({x:x4,y:this.anchors[1].y});
                            }
                        }
                    }
                    else if(this.anchorFrom==1){
                        // 上邊節點出
                        this.segments.push({x:aC1.x,y:aC1.y-ARROW_DIS});
                        if(this.anchorTo==0){
                            // 左邊節點入
                            let x3=x1;
                            let y3=y1-ARROW_DIS;
                            let x4=x2-ARROW_DIS;
                            let y4=y2;
                            if(x3<=x4 && y3>=y4){
                                //第一象限
                                this.segments.push({x:this.anchors[0].x,y:y3});
                                this.segments.push({x:this.anchors[0].x,y:y4});
                            }
                            else if(x3>x4 && y3>y4){
                                //第二象限
                                this.segments.push({x:x3,y:this.anchors[0].y});
                                this.segments.push({x:this.anchors[1].x,y:this.anchors[0].y});
                                this.segments.push({x:this.anchors[1].x,y:y4});
                            }
                            else if(x3>=x4 && y3<=y4){
                                //第三象限
                                this.segments.push({x:x3,y:this.anchors[0].y});
                                this.segments.push({x:this.anchors[1].x,y:this.anchors[0].y});
                                this.segments.push({x:this.anchors[1].x,y:y4});
                            }
                            else{
                                //第四象限
                                this.segments.push({x:x3,y:this.anchors[0].y});
                                this.segments.push({x:this.anchors[1].x,y:this.anchors[0].y});
                                this.segments.push({x:this.anchors[1].x,y:y4});
                            }

                        }
                        else if(this.anchorTo==1){
                            // 上邊節點入
                            let x3=x1;
                            let y3=y1-ARROW_DIS;
                            let x4=x2;
                            let y4=y2-ARROW_DIS;
                            this.segments.push({x:x3,y:this.anchors[0].y});
                            this.segments.push({x:x4,y:this.anchors[0].y});
                        }
                        else if(this.anchorTo==2){
                            // 右邊節點入
                            let x3=x1;
                            let y3=y1-ARROW_DIS;
                            let x4=x2+ARROW_DIS;
                            let y4=y2;
                            if(x3<=x4 && y3>=y4){
                                //第一象限
                                this.segments.push({x:x3,y:this.anchors[0].y});
                                this.segments.push({x:this.anchors[1].x,y:this.anchors[0].y});
                                this.segments.push({x:this.anchors[1].x,y:y4});
                            }
                            else if(x3>x4 && y3>y4){
                                //第二象限
                                this.segments.push({x:x3,y:y4});
                            }
                            else if(x3>=x4 && y3<=y4){
                                //第三象限
                                this.segments.push({x:x3,y:this.anchors[0].y});
                                this.segments.push({x:this.anchors[1].x,y:this.anchors[0].y});
                                this.segments.push({x:this.anchors[1].x,y:y4});
                            }
                            else{
                                //第四象限
                                this.segments.push({x:x3,y:this.anchors[0].y});
                                this.segments.push({x:this.anchors[1].x,y:this.anchors[0].y});
                                this.segments.push({x:this.anchors[1].x,y:y4});
                            }
                        }
                        else if(this.anchorTo==3){
                            // 下邊節點入
                            let x3=x1;
                            let y3=y1-ARROW_DIS;
                            let x4=x2;
                            let y4=y2+ARROW_DIS;
                            if(x3<=x4 && y3>=y4){
                                //第一象限
                                this.segments.push({x:x3,y:this.anchors[0].y});
                                this.segments.push({x:x4,y:this.anchors[0].y});
                            }
                            else if(x3>x4 && y3>y4){
                                //第二象限
                                this.segments.push({x:x3,y:this.anchors[0].y});
                                this.segments.push({x:x4,y:this.anchors[0].y});
                            }
                            else if(x3>=x4 && y3<=y4){
                                //第三象限
                                this.segments.push({x:x3,y:this.anchors[0].y});
                                this.segments.push({x:this.anchors[1].x,y:this.anchors[0].y});
                                this.segments.push({x:this.anchors[1].x,y:this.anchors[2].y});
                                this.segments.push({x:x4,y:this.anchors[2].y});
                            }
                            else{
                                //第四象限
                                this.segments.push({x:x3,y:this.anchors[0].y});
                                this.segments.push({x:this.anchors[1].x,y:this.anchors[0].y});
                                this.segments.push({x:this.anchors[1].x,y:this.anchors[2].y});
                                this.segments.push({x:x4,y:this.anchors[2].y});
                            }
                        }
                    }
                    else if(this.anchorFrom==2){
                        // 右邊節點出
                        this.segments.push({x:aC1.x+ARROW_DIS,y:aC1.y});
                        if(this.anchorTo==0){
                            // 左邊節點入
                            let x3=x1+ARROW_DIS;
                            let y3=y1;
                            let x4=x2-ARROW_DIS;
                            let y4=y2;
                            if(x3<=x4 && y3>=y4){
                                //第一象限
                                this.segments.push({x:this.anchors[0].x,y:y3});
                                this.segments.push({x:this.anchors[0].x,y:y4});
                            }
                            else if(x3>x4 && y3>y4){
                                //第二象限
                                this.segments.push({x:this.anchors[0].x,y:y3});
                                this.segments.push({x:this.anchors[0].x,y:this.anchors[1].y});
                                this.segments.push({x:this.anchors[2].x,y:this.anchors[1].y});
                                this.segments.push({x:this.anchors[2].x,y:y4});
                            }
                            else if(x3>=x4 && y3<=y4){
                                //第三象限
                                this.segments.push({x:this.anchors[0].x,y:y3});
                                this.segments.push({x:this.anchors[0].x,y:this.anchors[1].y});
                                this.segments.push({x:this.anchors[2].x,y:this.anchors[1].y});
                                this.segments.push({x:this.anchors[2].x,y:y4});
                            }
                            else{
                                //第四象限
                                this.segments.push({x:this.anchors[0].x,y:y3});
                                this.segments.push({x:this.anchors[0].x,y:y4});
                            }

                        }
                        else if(this.anchorTo==1){
                            // 上邊節點入
                            let x3=x1+ARROW_DIS;
                            let y3=y1;
                            let x4=x2;
                            let y4=y2-ARROW_DIS;
                            if(x3<=x4 && y3>=y4){
                                //第一象限
                                this.segments.push({x:this.anchors[0].x,y:y3});
                                this.segments.push({x:this.anchors[0].x,y:this.anchors[1].y});
                                this.segments.push({x:x4,y:this.anchors[1].y});
                            }
                            else if(x3>x4 && y3>y4){
                                //第二象限
                                this.segments.push({x:this.anchors[0].x,y:y3});
                                this.segments.push({x:this.anchors[0].x,y:this.anchors[1].y});
                                this.segments.push({x:x4,y:this.anchors[1].y});
                            }
                            else if(x3>=x4 && y3<=y4){
                                //第三象限
                                this.segments.push({x:this.anchors[0].x,y:y3});
                                this.segments.push({x:this.anchors[0].x,y:this.anchors[1].y});
                                this.segments.push({x:x4,y:this.anchors[1].y});
                            }
                            else{
                                //第四象限
                                this.segments.push({x:this.anchors[0].x,y:y3});
                                this.segments.push({x:this.anchors[0].x,y:this.anchors[1].y});
                                this.segments.push({x:x4,y:this.anchors[1].y});
                            }
                        }
                        else if(this.anchorTo==2){
                            // 右邊節點入
                            let x3=x1+ARROW_DIS;
                            let y3=y1;
                            let x4=x2+ARROW_DIS;
                            let y4=y2;
                            if(x3<=x4 && y3>=y4){
                                //第一象限
                                this.segments.push({x:this.anchors[0].x,y:y3});
                                this.segments.push({x:this.anchors[0].x,y:y4});
                            }
                            else if(x3>x4 && y3>y4){
                                //第二象限
                                this.segments.push({x:this.anchors[0].x,y:y3});
                                this.segments.push({x:this.anchors[0].x,y:y4});
                            }
                            else if(x3>=x4 && y3<=y4){
                                //第三象限
                                this.segments.push({x:this.anchors[0].x,y:y3});
                                this.segments.push({x:this.anchors[0].x,y:y4});
                            }
                            else{
                                //第四象限
                                this.segments.push({x:this.anchors[0].x,y:y3});
                                this.segments.push({x:this.anchors[0].x,y:y4});
                            }
                        }
                        else if(this.anchorTo==3){
                            // 下邊節點入
                            let x3=x1+ARROW_DIS;
                            let y3=y1;
                            let x4=x2;
                            let y4=y2+ARROW_DIS;
                            if(x3<=x4 && y3>=y4){
                                //第一象限
                                this.segments.push({x:x4,y:y3});
                            }
                            else if(x3>x4 && y3>y4){
                                //第二象限
                                this.segments.push({x:this.anchors[0].x,y:y3});
                                this.segments.push({x:this.anchors[0].x,y:this.anchors[1].y});
                                this.segments.push({x:x4,y:this.anchors[1].y});
                            }
                            else if(x3>=x4 && y3<=y4){
                                //第三象限
                                this.segments.push({x:this.anchors[0].x,y:y3});
                                this.segments.push({x:this.anchors[0].x,y:this.anchors[1].y});
                                this.segments.push({x:x4,y:this.anchors[1].y});
                            }
                            else{
                                //第四象限
                                this.segments.push({x:this.anchors[0].x,y:y3});
                                this.segments.push({x:this.anchors[0].x,y:this.anchors[1].y});
                                this.segments.push({x:x4,y:this.anchors[1].y});
                            }
                        }
                    }
                    else if(this.anchorFrom==3){
                        // 下邊節點出
                        this.segments.push({x:aC1.x,y:aC1.y+ARROW_DIS});
                        if(this.anchorTo==0){
                            // 左邊節點入
                            let x3=x1;
                            let y3=y1+ARROW_DIS;
                            let x4=x2-ARROW_DIS;
                            let y4=y2;
                            if(x3<=x4 && y3>=y4){
                                //第一象限
                                this.segments.push({x:x3,y:this.anchors[0].y});
                                this.segments.push({x:this.anchors[1].x,y:this.anchors[0].y});
                                this.segments.push({x:this.anchors[1].x,y:y4});
                            }
                            else if(x3>x4 && y3>y4){
                                //第二象限
                                this.segments.push({x:x3,y:this.anchors[0].y});
                                this.segments.push({x:this.anchors[1].x,y:this.anchors[0].y});
                                this.segments.push({x:this.anchors[1].x,y:y4});
                            }
                            else if(x3>=x4 && y3<=y4){
                                //第三象限
                                this.segments.push({x:x3,y:this.anchors[0].y});
                                this.segments.push({x:this.anchors[1].x,y:this.anchors[0].y});
                                this.segments.push({x:this.anchors[1].x,y:y4});
                            }
                            else{
                                //第四象限
                                this.segments.push({x:x3,y:y4});
                            }
                        }
                        else if(this.anchorTo==1){
                            // 上邊節點入
                            let x3=x1;
                            let y3=y1+ARROW_DIS;
                            let x4=x2;
                            let y4=y2-ARROW_DIS;
                            if(x3<=x4 && y3>=y4){
                                //第一象限
                                this.segments.push({x:x3,y:this.anchors[0].y});
                                this.segments.push({x:this.anchors[1].x,y:this.anchors[0].y});
                                this.segments.push({x:this.anchors[1].x,y:this.anchors[2].y});
                                this.segments.push({x:x4,y:this.anchors[2].y});
                            }
                            else if(x3>x4 && y3>y4){
                                //第二象限
                                this.segments.push({x:x3,y:this.anchors[0].y});
                                this.segments.push({x:this.anchors[1].x,y:this.anchors[0].y});
                                this.segments.push({x:this.anchors[1].x,y:this.anchors[2].y});
                                this.segments.push({x:x4,y:this.anchors[2].y});
                            }
                            else if(x3>=x4 && y3<=y4){
                                //第三象限
                                this.segments.push({x:x3,y:this.anchors[0].y});
                                this.segments.push({x:x4,y:this.anchors[0].y});
                            }
                            else{
                                //第四象限
                                this.segments.push({x:x3,y:this.anchors[0].y});
                                this.segments.push({x:x4,y:this.anchors[0].y});
                            }
                        }
                        else if(this.anchorTo==2){
                            // 右邊節點入
                            let x3=x1;
                            let y3=y1+ARROW_DIS;
                            let x4=x2+ARROW_DIS;
                            let y4=y2;
                            if(x3<=x4 && y3>=y4){
                                //第一象限
                                this.segments.push({x:x3,y:this.anchors[0].y});
                                this.segments.push({x:this.anchors[1].x,y:this.anchors[0].y});
                                this.segments.push({x:this.anchors[1].x,y:y4});
                            }
                            else if(x3>x4 && y3>y4){
                                //第二象限
                                this.segments.push({x:x3,y:this.anchors[0].y});
                                this.segments.push({x:this.anchors[1].x,y:this.anchors[0].y});
                                this.segments.push({x:this.anchors[1].x,y:y4});
                            }
                            else if(x3>=x4 && y3<=y4){
                                //第三象限
                                this.segments.push({x:x3,y:y4});
                            }
                            else{
                                //第四象限
                                this.segments.push({x:x3,y:this.anchors[0].y});
                                this.segments.push({x:this.anchors[1].x,y:this.anchors[0].y});
                                this.segments.push({x:this.anchors[1].x,y:y4});
                            }
                        }
                        else if(this.anchorTo==3){
                            // 下邊節點入
                            let x3=x1;
                            let y3=y1+ARROW_DIS;
                            let x4=x2;
                            let y4=y2+ARROW_DIS;
                            this.segments.push({x:x3,y:this.anchors[0].y});
                            this.segments.push({x:x4,y:this.anchors[0].y});
                        }
                    }
                    this.segments.push({x:aC2.x,y:aC2.y});
                    let ind = 0;
                    for(let i=2; i<this.segments.length-1; i++){
                        if(this.segments[i].x==aC1.x||this.segments[i-1].x==aC2.x||this.segments[i].y==aC1.y||this.segments[i-1].y==aC2.y){
                            continue;
                        }
                        if(this.segments[i-1].x == this.segments[i].x){
                            this.new_anchors.push(new first_model.anchor( (this.segments[i-1].x+this.segments[i].x)/2, (this.segments[i-1].y+this.segments[i].y)/2 , "w-resize") )
                            this.anchors[ind].x = (this.segments[i-1].x+this.segments[i].x)/2
                            this.anchors[ind].y = (this.segments[i-1].y+this.segments[i].y)/2 
                            ind++;
                        }
                        else if(this.segments[i-1].y+this.segments[i].y){
                            this.new_anchors.push(new first_model.anchor( (this.segments[i-1].x+this.segments[i].x)/2, (this.segments[i-1].y+this.segments[i].y)/2 , "n-resize") )
                            this.anchors[ind].x = (this.segments[i-1].x+this.segments[i].x)/2
                            this.anchors[ind].y = (this.segments[i-1].y+this.segments[i].y)/2    
                            ind++;                     
                        }
                    }
                    this.indexText=Math.floor(this.segments.length/2);
                    return;
                }
                else
                {
                    d1=this.directionToVector(first_model.nodes[from].connectors[this.anchorFrom].cursorClass);
                    d2=this.directionToVector(first_model.nodes[to].connectors[this.anchorTo].cursorClass);
                }
                
            }

            //LINKTEXT POSITION
            var element0 = this.segments[0];
            var maxD=0;
            this.indexText=1;
            for (let index = 1; index < this.segments.length; index++) {
                const element = this.segments[index];
                var d=Math.abs(element.x-element0.x)+Math.abs(element.y-element0.y);
                if (d>maxD){
                    maxD=d;
                    this.indexText=index;
                }
                element0=element;
            }

        }    
    
        this.checkConflict=function(x1,y1,x2,y2,node){
            if (x1==x2){
                //V
                var nY1=y1;
                var nY2=y2;
                if (y1>y2)
                {
                    nY1=y2;
                    nY2=y1;
                }
                if (x1>=node.x && x1<=node.x+node.w)
                {
                    if (nY1<=node.y && nY2>=node.y)
                    {
                        return "V";
                    }
                }
            }
            else
            {
                //H
            }
            return null;
        }

        this.reSegment();
        
        this.arrow=function(context, fromx, fromy, tox, toy) {
            var headlen = DIAGRAMFLOW_ARROW_SIZE; // length of head in pixels
            headlen=15;
            var dx = tox - fromx;
            var dy = toy - fromy;
            var angle = Math.atan2(dy, dx);
            if (first_model.rough){
                const rc=rough.canvas(document.getElementById(context.canvas.id));
                rc.line(fromx,fromy,tox,toy);
            }
            else{
                context.beginPath();
                context.moveTo(fromx, fromy);
                context.lineTo(tox, toy);
                context.stroke();
            }

            context.beginPath();
            context.fillStyle="black";
            context.moveTo(tox, toy);
            context.lineTo(tox - headlen * Math.cos(angle - Math.PI / 10), toy - headlen * Math.sin(angle - Math.PI / 10));
            //context.moveTo(tox, toy);
            context.lineTo(tox - headlen * Math.cos(angle + Math.PI / 10), toy - headlen * Math.sin(angle + Math.PI / 10));
            context.fill();
          }        
    
        this.draw=function(ctx){
            //PATH
            ctx.beginPath();
            ctx.lineWidth=2;
            ctx.strokeStyle = this.strokeStyle || "black";
            const element = this.segments[0];
            ctx.moveTo(element.x,element.y);
            for (let index = 1; index < this.segments.length-1; index++) {
                const element = this.segments[index];
                ctx.lineTo(element.x,element.y);
            }
            ctx.stroke();
            //TEXT
            var elementT=this.segments[this.indexText];
            var elementT0=this.segments[this.indexText-1];
            ctx.beginPath();
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(this.text,(elementT.x+elementT0.x)/2,(elementT.y+elementT0.y)/2);
            ctx.fill();

            var elementT=this.segments[this.segments.length-2];
            var elementT0=this.segments[this.segments.length-1];
            this.arrow(ctx,elementT.x,elementT.y,elementT0.x,elementT0.y);
            // //ENDPOINT
            // var element1 = this.segments[this.segments.length-1];
            // ctx.beginPath();
            // ctx.fillStyle=this.strokeStyle;
            // ctx.strokeStyle = this.strokeStyle;
            // ctx.arc(element1.x,element1.y,2*2,0,2*Math.PI,false);
            // ctx.fill();

            
        }
        this.highlight=function(ctx){
            //SEGMENT
            ctx.beginPath();
            ctx.strokeStyle = this.strokeStyleHighlight;
            const element = this.segments[0];
            ctx.moveTo(element.x,element.y);
            for (let index = 1; index < this.segments.length; index++) {
                const element = this.segments[index];
                ctx.lineTo(element.x,element.y);
            }
            var element1 = this.segments[this.segments.length-1];
            ctx.stroke();
            //ENDPOINT
            ctx.beginPath();
            ctx.fillStyle=this.strokeStyleHighlight;
            ctx.strokeStyle = this.strokeStyleHighlight;
            ctx.arc(element1.x,element1.y,2*2,0,2*Math.PI,false);
            ctx.fill();
            
            this.anchors.forEach(element => {
                element.draw(first_model.ctx,element.x,element.y,0,0);
            });
        }
    
        this.distance=function(a,b){
            return Math.sqrt((a.x-b.x)*(a.x-b.x) + (a.y-b.y)*(a.y-b.y));
        }
        this.isBetween=function(a,c,b){
            return this.distance(a,c)+this.distance(c,b)-this.distance(a,b)<1;
        }
        this.isOverLink=function(point){
            for (let index = 1; index < this.segments.length; index++) {
                const element = this.segments[index];
                const element0 = this.segments[index-1];
                if (this.isBetween(element0,point,element))
                    return true;
            }
            return false;
        }
        this.isInsideAnchors=function(x,y){
            for (let index = 0; index < this.anchors.length; index++) {
                const element = this.anchors[index];
                //console.log(x,y,this.x,this.y,10,10)
                if (element.isInside(x,y,element.x,element.y,0,0))
                {
                    return index;
                }
            }
            return null;
        };
    }
};
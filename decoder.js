function check_var(str, can_number){
    if(!str){
        return false;
    }
    var check_or = new RegExp(/ and | or |或|且/g);
    var check_equal = new RegExp(/[><=]/g);
    var check_add = new RegExp(/[\+\-\*\/]/g);
    var check_array = new RegExp(/([^\[\]]+)+\[(.*?)\]/);
    


    var and_list = str.split(check_or)
    for(let j=0;j<and_list.length;j++){
        if(and_list[j].includes(' not ')){
            and_list[j] = and_list[j].replaceAll('not', '')
        }
        

        var op_list = and_list[j].replaceAll(" ", "").split(check_equal)
        // console.log(op_list)
        for(let i=0;i<op_list.length;i++){
            if(op_list[i].search(check_add)>0){
                var add_list = (op_list[i].split(check_add))
                for(let k=0;k<add_list.length;k++){
                    /*if(var_list.includes(add_list[k])){
                    }
                    else if(!isNaN(parseFloat(add_list[k]))&&isFinite(add_list[k])){
                    }
                    else{
                        alert("\'"+add_list[k]+"\' is not defined.");
                        return false;
                    }*/
                    op_list.splice(i+k+1,0,add_list[k]);
                }
                op_list.splice(i,1)
            }
        
            if(type_var_list["number"].includes(op_list[i]) || type_var_list["text"].includes(op_list[i])){
            }
            else if(!isNaN(parseFloat(op_list[i]))&&isFinite(op_list[i]) && can_number){
            }
			else if(/^".*"$/.test(op_list[i]) && can_number){
            }
            else{
                var matches = op_list[i].match(check_array);
                if(matches != null){
                    var A = matches[1];
                    var B = matches[2];
                    if(!type_var_list["number"].includes(B)&&(!(!isNaN(parseFloat(B))&&isFinite(B)))){
                        alert("\'"+B+"\' 沒有定義或不是數字.");
                        return false;
                    }
                    if(!type_var_list["array"].includes(A)){
                        alert("array \'"+A+"\' 沒有定義.");
                        return false;
                    }
                }
                else{
                    if(type_var_list["array"].includes(op_list[i])){
                        alert("\'"+op_list[i]+"\' 是一個清單.");
                        return false;
                    }
                    else{
                        alert("\'"+op_list[i]+"\' 沒有定義.");
                        return false;
                    }
                }
            }
        }
    }
    return true;
}

function get_code_var(str){
	let ret=[];
	for(let i=0;i<var_list['name'].length;i++){
		if(str.includes(var_list['name'][i])){
			ret.push(var_list['name'][i]);
		}
	}
	return ret;
}

function to_condition(str){
    if(str.includes("=")){
        str = str.replaceAll("=", "==");
    }
    if(str.includes(" not ")){
        str = str.replaceAll("not", "!").replaceAll("非", "!");
    }
    if(str.includes(" and ")){
        str = str.replaceAll("and", "&&").replaceAll("且", "&&");
    }
    if(str.includes(" or ")){
        str = str.replaceAll("or", "||").replaceAll("或", "||");
    }
    //console.log(str);
    return str;
}

var output_result = '';
var step_list = {
    "step":[],
    "var":[],
    "output":[]
};

function to_code(node){
    let var_str = "{";
    for(let i = 0;i < var_list.name.length;i++){
        var_str += "\""+var_list.name[i]+"\": "+var_list.name[i];
        if(i < var_list.name.length-1){
            var_str += ",";
        }
    }
	var_str += "}"
    if(node.figure=="Circle"){
        if(node.text=="開始"){
            //console.log((model.links.find(element => element.from==model.nodes.indexOf(node))));
            return {
                        "code":"function flowchart_code(input_list){\nUpdate_output("+model.nodes.indexOf(node)+", "+var_str+");\n",
                        "next":model.nodes[(model.links.find(element => element && element.from==model.nodes.indexOf(node))).to]
                    };
        }
        else{
            return {
                "code":"total_step ++;\nUpdate_output("+model.nodes.indexOf(node)+", "+var_str+");\n}\n",
                "next":-1
            };
        }
    }
    else if(node.figure=="Parallelogram"){
        let str=node.text;
        if(str.split(" ")[0].includes("輸入")){
            var code = str.split(" ")[1]+' = input_list.shift();\n' + 
                    'if( parseFloat('+str.split(" ")[1]+').toString() != "NaN" ) {\n' + 
                    str.split(" ")[1]+' = Number('+str.split(" ")[1]+') \n }\n';
            return {
                "code":code+"total_step ++;\nUpdate_output("+model.nodes.indexOf(node)+", "+var_str+");\n",
                "next":model.nodes[model.links.find(element => element && element.from==model.nodes.indexOf(node)).to]
            };
        }
        else{
            var code = "output_result += (";
            for(let i=1;i<str.split(" ").length;i++){
                code += (str.split(" ")[i] + " ");
            }
            code += "+\"\\n\");\n";
            return {
                "code":code+"total_step ++;\nUpdate_output("+model.nodes.indexOf(node)+", "+var_str+");\n",
                "next":model.nodes[model.links.find(element => element && element.from==model.nodes.indexOf(node)).to]
            };
        }
    }
    else if(node.figure=="Diamond"){
        var code;
        code = "if("+ to_condition(node.text)+"){\nUpdate_output("+model.nodes.indexOf(node)+", "+var_str+");\n";
        let ie = if_generator(node)
        code += ie.code;
        code += "}else{\nUpdate_output("+model.nodes.indexOf(node)+", "+var_str+");\n";
        code += else_generator(node).code;
        code += '}\n';
        return {
            "code":code+"total_step ++;\n",
            "next": ie.next
        };
    }
    else if(node.figure=="For_Loop"){
        var code;
        var l;
		code = "for(let counter"+model.nodes.indexOf(node)+"=0; counter"+model.nodes.indexOf(node)+"<"+ node.text.substr(0,node.text.length-1) + ";counter"+model.nodes.indexOf(node)+"++){\ntotal_step ++;Update_output("+model.nodes.indexOf(node)+", "+var_str+");\n";
		console.log(code);
		l = loop_generator(node);
		code += 'if(--window.LoopTrap < 0){\n'
		code += ' break;\n}\n';
		code += l.code + "\n";
		code += '}\n';
		code += "total_step ++;Update_output("+model.nodes.indexOf(node)+", "+var_str+");\n"
        return {
            "code":code,
            "next": l.next
        };
    }
	else if(node.figure=="While_Loop"){
        var code;
        var l;
        
		code = "while(!("+ to_condition(node.text) + ")){\ntotal_step ++;Update_output("+model.nodes.indexOf(node)+", "+var_str+");\n";
		l = loop_generator(node);
		code += 'if(--window.LoopTrap < 0){\n'
		code += ' break;\n}\n';
		code += l.code + "\n";
		code += '}\n';
		code += "total_step ++;Update_output("+model.nodes.indexOf(node)+", "+var_str+");\n"
        
        return {
            "code":code,
            "next": l.next
        };
    }
    else if(node.figure=="Rectangle"){
		var code;
        let change_var = node.text.split(" ")[0]; //改變數用 還沒做
		code = node.text.replaceAll("設為","= "+node.data+"(").split("(取")[0];
		code += ");\ntotal_step ++;Update_output("+model.nodes.indexOf(node)+", "+var_str+");\n"
        return {
            "code":code,
            "next":model.nodes[model.links.find(element => element && element.from==model.nodes.indexOf(node)).to]
        }
    }
}

function loop_generator(node){
    let next_node = model.nodes[model.links.find(element => element && element.from==model.nodes.indexOf(node) && (element.text.includes("進入迴圈") || element.text.includes("假"))).to];
    console.log("next_node = "+next_node);
	var code = "";
    while(next_node!= node){
        code += to_code(next_node).code;
        next_node = to_code(next_node).next;
		console.log("code = "+code);
    }
    next_node = model.nodes[model.links.find(element => element && element.from==model.nodes.indexOf(node) && (element.text.includes("離開迴圈") || element.text.includes("真"))).to];
    return {
        "code":code,
        "next": next_node
    };
}

function if_generator(node){
    //遇到菱形就進來
    let true_link = model.links.find(element => element && element.from==model.nodes.indexOf(node) && (element.text.includes("true") || element.text.includes("真")));
    let false_link = model.links.find(element => element && element.from==model.nodes.indexOf(node) && (element.text.includes("false")|| element.text.includes("假")));
    let next_node = model.nodes[true_link.to];
    var code = "";

    let node_link_num = model.links.filter(element => element && element.to==model.nodes.indexOf(next_node)).length;
    while((next_node.figure!="Diamond" && node_link_num==1) || (next_node.figure=="Diamond" && node_link_num<2)){
		code += to_code(next_node).code;
        next_node = to_code(next_node).next;
        node_link_num = model.links.filter(element => element && element.to==model.nodes.indexOf(next_node)).length;
    }

    return {
        "code":code,
        "next": next_node
    };
}

function else_generator(node){
    //遇到菱形就進來
    let true_link = model.links.find(element => element && element.from==model.nodes.indexOf(node) && (element.text.includes("true") || element.text.includes("真")));
    let false_link = model.links.find(element => element && element.from==model.nodes.indexOf(node) && (element.text.includes("false")|| element.text.includes("假")));
    let next_node = model.nodes[false_link.to];
    var code = "";

    let node_link_num = model.links.filter(element => element && element.to==model.nodes.indexOf(next_node)).length;
    while((next_node.figure!="Diamond" && node_link_num==1) || (next_node.figure=="Diamond" && node_link_num<2)){
        code += to_code(next_node).code;
        next_node = to_code(next_node).next;
        node_link_num = model.links.filter(element => element && element.to==model.nodes.indexOf(next_node)).length;
    }

    return {
        "code":code,
        "next": next_node
    };
}
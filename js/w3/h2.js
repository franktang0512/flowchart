var title = "怒氣值";
var question = "冒險遊戲中，攻擊可以累積怒氣值，可以讓傷害增加。怒氣值累積到30~50，攻擊力提升1.2倍；累積到50~80，攻擊力提升1.5倍；累積到80以上，攻擊力兩倍。請根據輸入的初始攻擊力與現在累積的怒氣值，輸出造成的傷害。\n";
var array = [
    /*["夜市牛排", "200"],
    ["藥燉排骨", "120"],
    ["炸雞排", "60"],
    ["奶茶", "55"],
    ["臭豆腐", "40"],
    ["地瓜球", "30"]*/
]
var test_case = [
    {
        input: "80 30",
        output: "96",
        note: "怒氣值30，提升攻擊力1.2倍。傷害為80*1.2=96"
    },
	{
        input: "100 100",
        output: "200",
        note: "怒氣值100，提升攻擊力2倍。傷害為100*2=200"
    }
]

$(document).ready(function(){
    $("#question_name").text("題目名稱："+title)
    $("#question_info").text(question);
    $("#example_testcase").append(
        '<tr>\
            <th style="width: 20%;">輸入</th>\
            <th style="width: 20%;">輸出</th>\
            <th style="width: 30%;">說明</th>\
        </tr>'
    )    
    for(let i=0;i<test_case.length;i++){
        $("#example_testcase").append(
            '<tr>\
                <td style="width: 20%;">'+test_case[i].input+'</td>\
                <td style="width: 20%;">'+test_case[i].output+'</td>\
                <td style="width: 30%;">'+test_case[i].note+'</td>\
            </tr>'
        )  
    }
    for(let i=0;i<array.length;i++){
        $("#array").append(
            '<tr>\
                <td style="width: 20%;">'+array[i][0]+'</td>\
                <td style="width: 20%;">'+array[i][1]+'</td>\
            </tr>'
        )  
    }
    
})
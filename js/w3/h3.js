var title = "排位獎勵";
var question = "遊戲中，會根據積分給予不同的排位，也會根據積分與排位給予不同的金幣獎勵。請根據玩家積分，輸出對應的排位與應獲得的金幣數量。\n";
var array = [
    ["排位", "分數", "獎勵倍率"],
    ["金牌", "10000", "× 1.8"],
    ["銀牌", "5000", "× 1.4"],
    ["銅牌", "0", "× 1"]
]
var test_case = [
    {
        input: "1500",
        output: "銅牌 1500",
        note: "積分1500的玩家，排位為銅牌，獲得金幣1500*1 = 1500"
    },
	{
        input: "6000",
        output: "銀牌 8400",
        note: "積分6000的玩家，排位為金牌，獲得金幣6000*1.4 = 8400"
    },
	{
        input: "12000",
        output: "金牌 21600",
        note: "積分12000的玩家，排位為金牌，獲得金幣12000*1.8 = 21600"
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
        var str = '<tr>';
        for(let j=0;j<array[0].length;j++){
            str += '<td style="width: 20%;">'+array[i][j]+'</td>'
        }
        str += '</tr>\n';
        $("#array").append(str)  
    }
    
})